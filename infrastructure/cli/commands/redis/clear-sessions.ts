import {Client, RedisClientType} from './index.js'
import {Client as EcrClient} from '../ecr/index.js'
import {namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {confirm} from '../../lib/interactive.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Port-forward Elasticache Redis to a local port',
)

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  await confirm(
    'Clear all sessions stored in redis?',
    async () => {
      const ns = namespace(environment)
      const client = await Client.load(environment)
      const ecrClient = await EcrClient.load(environment)
      const port = (Math.random() * 2000 + 8000).toFixed(0)

      const controller = new AbortController()

      await ecrClient.runPortForwardPod(
        ns,
        port,
        client.primaryEndpointAddress,
        6379,
        controller.signal,
        async () => {
          await client.connectToRedisLocally(port, (redisClient) => clearSessions(redisClient))
          controller.abort()
        },
      )
    },
    {proceedUnlessProduction: environment}
  )
}

async function clearSessions(redisClient: RedisClientType): Promise<void> {
  process.stderr.write('Clearing sessions…\n')
  let totalDeletedCount = 0

  let cursor = 0
  do {
    const reply = await redisClient.scan(cursor, {
      MATCH: 'sess:*',
      COUNT: 50,
    })
    cursor = reply.cursor
    totalDeletedCount += await redisClient.del(reply.keys)
  } while (cursor !== 0)

  if (totalDeletedCount) {
    process.stderr.write(`Deleted ${totalDeletedCount} sessions\n`)
  } else {
    process.stderr.write('No sessions to delete\n')
  }
}
