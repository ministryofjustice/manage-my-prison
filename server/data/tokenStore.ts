import { createClient } from 'redis'

import logger from '../../logger'
import config from '../config'

const redisURL =
  config.redis.tls_enabled === 'true'
    ? `rediss://${config.redis.host}:${config.redis.port}`
    : `redis://${config.redis.host}:${config.redis.port}`

const createRedisClient = () => {
  return createClient({
    url: redisURL,
    password: config.redis.password,
  })
}

export type RedisClient = ReturnType<typeof createRedisClient>

export default class TokenStore {
  private readonly prefix = 'systemToken:'

  private readonly redisClient: RedisClient

  constructor(redisClient: RedisClient = createRedisClient()) {
    this.redisClient = redisClient
    redisClient.on('error', error => {
      logger.error(error, `Redis error`)
    })
  }

  public async setToken(key: string, token: string, durationSeconds: number): Promise<void> {
    if (!this.redisClient.isOpen) {
      await this.redisClient.connect()
    }
    await this.redisClient.set(`${this.prefix}${key}`, token, { EX: durationSeconds })
  }

  public async getToken(key: string): Promise<string | null> {
    if (!this.redisClient.isOpen) {
      await this.redisClient.connect()
    }
    return this.redisClient.get(`${this.prefix}${key}`)
  }
}
