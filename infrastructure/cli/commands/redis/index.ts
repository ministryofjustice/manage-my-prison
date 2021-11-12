import chalk from 'chalk'
import * as redis from 'redis'

import {Environment, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {Port} from '../../lib/misc.js'

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
    callback: (redisClient: redis.RedisClient) => void | Promise<void>,
  ): Promise<void> {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port
    process.stderr.write(`Connecting to redis on local port ${portNum}…\n`)
    const redisClient = redis.createClient({
      password: this.authToken,
      host: 'localhost',
      port: portNum,
      tls: {
        requestCert: false,
        rejectUnauthorized: false,
      },
    })
    const value = callback(redisClient)
    if (value && 'then' in value) {
      await value
    }
    return new Promise((resolve, reject) => {
      process.stderr.write('Redis quitting…\n')
      redisClient.quit((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}
