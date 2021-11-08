import {Client} from '../ecr/index.js'
import {EnvironmentOptions, Positional} from '../../lib/options.js'
import {DEPLOYMENT, Deployment, Environment, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {getMainPath} from '../../lib/paths.js'
import {OutputOptions, subprocess} from '../../lib/subprocess.js'
import {renderTemplate} from '../../lib/templates.js'

export const description = 'Manage apps running in Cloud Platform'

export interface DeploymentOptions extends EnvironmentOptions {
  deployment?: Deployment
}

export const DeploymentPositional: Positional = {
  name: 'deployment',
  default: DEPLOYMENT,
  description: 'Pods from this deployment are targeted',
}

/**
 * Looks up currently-deployed app version
 */
export async function getDeploymentVersion(
  namespace: string,
  deployment: Deployment = DEPLOYMENT
): Promise<string | null> {
  const kubernetes = new KubernetesApi()
  const deploymentDetails = await kubernetes.getDeployment(namespace, deployment)
  if (!deploymentDetails) {
    throw new Error(`Cannot find deployment ${deployment}`)
  }
  const containers = deploymentDetails.spec?.template.spec?.containers || []
  const currentVersion = containers
    .map(container => container.image)
    .filter(image => image && image.startsWith(`${Client.quayUrl}:`))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .map(image => image!.slice(Client.quayUrl.length + 1))[0]
  return currentVersion || null
}

type ExecScriptOptions = {
  namespace: string
  pod: string
  input: string
} & Partial<OutputOptions>

/**
 * Runs javascript within node on a given pod
 */
export async function execScript(options: ExecScriptOptions & {output: 'stdout'}): Promise<void>
export async function execScript(options: ExecScriptOptions & {output: 'text'}): Promise<string>
export async function execScript(options: ExecScriptOptions & {output: 'object'}): Promise<any>
export async function execScript(options: ExecScriptOptions): Promise<any>
export async function execScript({
  namespace,
  pod,
  input,
  output = 'stdout',
}: ExecScriptOptions): Promise<void | string | any> {
  process.stderr.write(`Running script on pod "${pod}"…\n`)
  const kubernetes = new KubernetesApi()
  return await kubernetes.exec(namespace, pod, ['node', '-'], {input, output})
}

type RemoteRequestOptions = Partial<OutputOptions>
type Response<T> = {
  [pod: string]: T
}

/**
 * Performs an HTTP request locally within a pod
 */
export async function remoteRequest(
  environment: Environment,
  url: string,
  options: RemoteRequestOptions & {output: 'stdout'}
): Promise<void>
export async function remoteRequest(
  environment: Environment,
  url: string,
  options: RemoteRequestOptions & {output: 'text'}
): Promise<Response<string>>
export async function remoteRequest(
  environment: Environment,
  url: string,
  options: RemoteRequestOptions & {output: 'object'}
): Promise<Response<any>>
export async function remoteRequest(
  environment: Environment,
  url: string,
  options: RemoteRequestOptions
): Promise<any>
export async function remoteRequest(
  environment: Environment,
  url: string,
  {output = 'stdout'}: RemoteRequestOptions = {}
): Promise<Response<string | any> | void> {
  const input = renderTemplate('scripts/remote/request.njk', {environment, url})
  const ns = namespace(environment)
  const kubernetes = new KubernetesApi()
  const pods = await kubernetes.getPodNames(ns)
  if (!pods.length) {
    process.stderr.write('No pods found to run script on.\n')
  } else {
    const responses: Response<string | any> = {}
    for (const pod of pods) {
      const response = await execScript({namespace: ns, pod, input, output})
      if (output === 'object' || output === 'text') {
        responses[pod] = response
      }
    }
    if (output === 'object' || output === 'text') {
      return responses
    }
  }
}

/**
 * Get checked-out git commit hash
 */
export async function currentCommitHash(): Promise<string> {
  return await subprocess('git', ['rev-parse', '--verify', 'HEAD'], {cwd: getMainPath(), output: 'text'})
}
