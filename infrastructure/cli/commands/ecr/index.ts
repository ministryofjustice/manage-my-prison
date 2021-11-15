import {ECRClient} from '@aws-sdk/client-ecr'
import {BatchDeleteImageCommand, BatchDeleteImageCommandOutput} from '@aws-sdk/client-ecr'
import {paginateDescribeImages, DescribeImagesRequest} from '@aws-sdk/client-ecr'
import {GetAuthorizationTokenCommand} from '@aws-sdk/client-ecr'
import {ImageIdentifier, ImageDetail} from '@aws-sdk/client-ecr'
import chalk from 'chalk'

import {quayUrl} from '../quay/index.js'
import {appName} from '../../lib/app.js'
import {Environment, REGION, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {Port, shortDigest} from '../../lib/misc.js'
import {SubprocessError} from '../../lib/subprocess.js'

export const description = 'Manage images stored in ECR'

type ImageFilter = Pick<DescribeImagesRequest, 'filter' | 'imageIds'>

export class Client {
  static async load(environment: Environment): Promise<Client> {
    const ns = namespace(environment)
    const kubernetes = new KubernetesApi()
    const secret = await kubernetes.getDecodedSecret(ns, `ecr-repo-${appName}-${environment}`)
    if (!secret) {
      throw new Error(`Cannot find ECR secret in ${ns}`)
    }
    const {repo_url: repoUrl, access_key_id: accessKeyId, secret_access_key: secretAccessKey} = secret
    const repoName = repoUrl.split('/').slice(1).join('/')
    const ecrDomain = repoUrl.split('/')[0]
    const ecrClient = new ECRClient({
      region: REGION,
      credentials: {accessKeyId, secretAccessKey},
    })
    return new Client(environment, repoUrl, repoName, ecrDomain, ecrClient)
  }

  private constructor(
    readonly environment: Environment,
    readonly repoUrl: string,
    readonly repoName: string,
    readonly ecrDomain: string,
    private readonly ecrClient: ECRClient,
  ) {}

  /**
   * Shortens docker image tags by replacing repository with an abbreviation
   */
  abbreviateImage(image: string): string {
    const prefixes = [
      [`${this.repoUrl}:`, '[ecr]:'],
      [`${quayUrl}:`, '[quay]:'],
    ]
    for (const [prefix, replacement] of prefixes) {
      if (image.startsWith(prefix)) {
        return `${replacement}${image.slice(prefix.length)}`
      }
    }
    return image
  }

  async describeImages(filters?: ImageFilter): Promise<ImageDetail[]> {
    const paginator = paginateDescribeImages({client: this.ecrClient}, {
      repositoryName: this.repoName,
      ...filters || {},
    })
    const list = []
    for await (const response of paginator) {
      const rows = response.imageDetails || []
      list.push(...rows)
    }
    return list
  }

  async deleteImages(imageDigests: string[]): Promise<BatchDeleteImageCommandOutput | undefined> {
    if (!imageDigests) {
      return
    }
    process.stderr.write(`Deleting ${imageDigests.length} images…\n`)
    const data = await this.ecrClient.send(new BatchDeleteImageCommand({
      repositoryName: this.repoName,
      imageIds: imageDigests.map(imageDigest => {
        return {imageDigest}
      }),
    }))
    const imageIds = data.imageIds as ImageIdentifier[] || []
    for (const {imageDigest, imageTag} of imageIds) {
      const tag = imageTag ? `  tag=${imageTag}` : ''
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      process.stderr.write(`Deleted ${shortDigest(imageDigest!)}${tag}\n`)
    }
    for (const failure of data.failures || []) {
      process.stderr.write(`FAILURE ${failure}\n`)
    }
    return data
  }

  async getAuthorisationToken(): Promise<{username: string, password: string, expiresAt?: Date}> {
    const response = await this.ecrClient.send(new GetAuthorizationTokenCommand({}))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const {authorizationToken, expiresAt} = response.authorizationData![0]
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const authorizationTokenDecoded = Buffer.from(authorizationToken!, 'base64').toString('utf8')
    const [username, password] = authorizationTokenDecoded.split(':')
    return {username, password, expiresAt}
  }

  async runPortForwardPod(
    namespace: string,
    localPort: Port,
    remoteAddress: string,
    remotePort: Port,
    signal?: AbortSignal,
    readyCallback?: () => void | Promise<void>,
  ): Promise<void> {
    const kubernetes = new KubernetesApi()
    const name = 'port-forward'
    const forwardingPort: Port = 8000
    const args = [`tcp:${remoteAddress}:${remotePort}`]
    await kubernetes.runPod(namespace, `${this.repoUrl}:${name}`, name, {port: forwardingPort, args})
    await kubernetes.portForward(namespace, name, localPort, forwardingPort, signal, readyCallback)
    process.stderr.write(`Deleting ${name} pod…\n`)
    await kubernetes.coreApi.deleteNamespacedPod(name, namespace)
    try {
      await kubernetes.condition(namespace, 'pod', name, 'Terminated')
      // eslint-disable-next-line no-empty
    } catch (e) {}
    process.stderr.write(`Pod ${name} deleted\n`)
  }
}

/**
 * Suggest logging into ECR if docker error indicates it’s necessary
 */
export function checkDockerError(environment: string, error: any): void {
  const errorMessage = error?.stderr
  if (errorMessage.includes('no basic auth credentials') || errorMessage.includes('authorization token has expired')) {
    process.stderr.write(chalk.red('Docker not authenticated'))
    process.stderr.write(`: Log into ECR with \`$ ecr docker-login ${environment}\`\n`)
  } else if (error instanceof SubprocessError) {
    process.stderr.write(chalk.red(error.message) + ':\n')
    process.stderr.write(error.stderr + '\n')
  } else {
    console.error(error)
  }
}
