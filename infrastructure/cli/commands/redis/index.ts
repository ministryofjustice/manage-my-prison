import chalk from 'chalk'

import {Environment, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'

export const description = 'Manage Elasticache Redis'

export class Client {
  static secretName = 'elasticache-redis'

  static async load(environment: Environment): Promise<Client> {
    const ns = namespace(environment)
    const kubernetes = new KubernetesApi()
    const secret = await kubernetes.getDecodedSecret(ns, Client.secretName)
    if (!secret) {
      throw new Error(`Cannot find Elasticache Redis secret in ${ns}`)
    }
    const {
      auth_token: authToken,
      member_clusters: memberClustersStr,
      primary_endpoint_address: primaryEndpointAddress,
    } = secret
    const memberClusters = JSON.parse(memberClustersStr)
    return new Client(environment, authToken, memberClusters, primaryEndpointAddress)
  }

  private constructor(
    readonly environment: Environment,
    readonly authToken: string,
    readonly memberClusters: string[],
    readonly primaryEndpointAddress: string
  ) {}

  howToGetSecret(): string {
    const ns = namespace(this.environment)
    const cli = `$ secret get ${this.environment} ${Client.secretName}` +
      ' | sed -n \'s/^auth_token=\\([0-9a-f]*\\)$/\\1/p'
    const kubectl = `kubectl -n ${ns} get secret ${Client.secretName} -o jsonpath={.data.auth_token} | base64 -D`
    return 'Get redis password using:\n' + chalk.green(cli) + '\nor\n' + chalk.green(kubectl) + '\n'
  }
}
