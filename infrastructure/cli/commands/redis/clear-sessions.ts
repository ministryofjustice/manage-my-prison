import * as redis from 'redis'

import {Client} from './index.js'
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

const SCAN_ENDED = '0'

async function clearSessions(redisClient: redis.RedisClient): Promise<void> {
  return new Promise((resolve, reject) => {
    redisClient.on('error', (err) => {
      reject(err)
    })

    let totalDeletedCount = 0

    function deleteNextBatch(cursor: string) {
      redisClient.scan(
        cursor,
        'MATCH', 'sess:*',
        'COUNT', '20',
        (err, [cursor, keys]
        ) => {
          if (err) {
            reject(err)
          } else if (keys.length) {
            redisClient.del(...keys, (err, deletedCount) => {
              if (err) {
                reject(err)
              } else {
                totalDeletedCount += deletedCount
                if (cursor === SCAN_ENDED) {
                  process.stderr.write(`Deleted ${totalDeletedCount} sessions\n`)
                  resolve()
                } else {
                  deleteNextBatch(cursor)
                }
              }
            })
          } else {
            process.stderr.write('No sessions to delete\n')
            resolve()
          }
        }
      )
    }

    process.stderr.write('Clearing sessions…\n')
    deleteNextBatch(SCAN_ENDED)
  })
}
