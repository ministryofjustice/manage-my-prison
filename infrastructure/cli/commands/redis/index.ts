import chalk from 'chalk'
import {createClient} from 'redis'

import {Environment, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {Port} from '../../lib/misc.js'

export const description = 'Manage Elasticache Redis'

function createLocalRedisClient(port: Port, password: string) {
  return createClient({
    url: `rediss://localhost:${port}`,
    password,
    socket: {
      tls: true,
      requestCert: false,
      rejectUnauthorized: false,
    },
  })
}

// NB: this more-ergonomic versions does not work for some reason; related to default redis modules
// export type RedisClientType = ReturnType<typeof createClient>
export type RedisClientType = ReturnType<typeof createLocalRedisClient>

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

  /**
   * Describes how to get redis secret
   */
  howToGetSecret(): string {
    const ns = namespace(this.environment)
    const cli = `$ secret get ${this.environment} ${Client.secretName}` +
      ' | sed -n \'s/^auth_token=\\([0-9a-f]*\\)$/\\1/p'
    const kubectl = `kubectl -n ${ns} get secret ${Client.secretName} -o jsonpath={.data.auth_token} | base64 -D`
    return 'Get redis password using:\n' + chalk.green(cli) + '\nor\n' + chalk.green(kubectl) + '\n'
  }

  async connectToRedisLocally(
    port: Port,
    callback: (redisClient: RedisClientType) => void | Promise<void>,
  ): Promise<void> {
    const redisClient = createLocalRedisClient(port, this.authToken)

    process.stderr.write(`Connecting to redis on local port ${port}…\n`)
    await redisClient.connect()
    const value = callback(redisClient)
    if (value && 'then' in value) {
      await value
    }

    process.stderr.write('Redis quitting…\n')
    await redisClient.quit()
  }
}
