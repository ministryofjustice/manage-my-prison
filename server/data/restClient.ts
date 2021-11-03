import superagent from 'superagent'
import Agent, { HttpsAgent } from 'agentkeepalive'
import { Readable } from 'stream'

import { ApiConfig } from '../config'
import sanitiseError from '../sanitisedError'
import type { UnsanitisedError } from '../sanitisedError'
import logger from '../../logger'

interface GetRequest {
  path?: string
  query?: string
  headers?: Record<string, string>
  responseType?: string
  raw?: boolean
}

interface PostRequest {
  path?: string
  headers?: Record<string, string>
  responseType?: string
  data?: Record<string, unknown>
  raw?: boolean
}

interface StreamRequest {
  path?: string
  headers?: Record<string, string>
  errorLogger?: (e: UnsanitisedError) => void
}

export default class RestClient {
  agent: Agent

  constructor(private readonly name: string, private readonly config: ApiConfig, private readonly token: string) {
    this.agent = config.url.startsWith('https') ? new HttpsAgent(config.agent) : new Agent(config.agent)
  }

  private apiUrl() {
    return this.config.url
  }

  private timeoutConfig() {
    return this.config.timeout
  }

  async get({ path, query = '', headers = {}, responseType = '', raw = false }: GetRequest = {}): Promise<unknown> {
    const pathString = path || ''
    logger.info(`Get using user credentials: calling ${this.name}: '${pathString}' ${query}`)
    try {
      const result = await superagent
        .get(`${this.apiUrl()}${pathString}`)
        .agent(this.agent)
        .retry(2, (err, res) => {
          if (err) logger.info(`Retry handler found API error with ${err.code} ${err.message}`)
          return undefined // retry handler only for logging retries, not to influence retry logic
        })
        .query(query)
        .auth(this.token, { type: 'bearer' })
        .set(headers)
        .responseType(responseType)
        .timeout(this.timeoutConfig())

      return raw ? result : result.body
    } catch (error) {
      const sanitisedError = sanitiseError(error as UnsanitisedError)
      logger.warn({ ...sanitisedError, query }, `Error calling ${this.name}, path: '${pathString}', verb: 'GET'`)
      throw sanitisedError
    }
  }

  async post({ path, headers = {}, responseType = '', data = {}, raw = false }: PostRequest = {}): Promise<unknown> {
    const pathString = path || ''
    logger.info(`Post using user credentials: calling ${this.name}: '${pathString}'`)
    try {
      const result = await superagent
        .post(`${this.apiUrl()}${pathString}`)
        .send(data)
        .agent(this.agent)
        .retry(2, (err, res) => {
          if (err) logger.info(`Retry handler found API error with ${err.code} ${err.message}`)
          return undefined // retry handler only for logging retries, not to influence retry logic
        })
        .auth(this.token, { type: 'bearer' })
        .set(headers)
        .responseType(responseType)
        .timeout(this.timeoutConfig())

      return raw ? result : result.body
    } catch (error) {
      const sanitisedError = sanitiseError(error as UnsanitisedError)
      logger.warn({ ...sanitisedError }, `Error calling ${this.name}, path: '${pathString}', verb: 'POST'`)
      throw sanitisedError
    }
  }

  async stream({ path, headers = {} }: StreamRequest = {}): Promise<unknown> {
    const pathString = path || ''
    logger.info(`Get using user credentials: calling ${this.name}: '${pathString}'`)
    return new Promise((resolve, reject) => {
      superagent
        .get(`${this.apiUrl()}${pathString}`)
        .agent(this.agent)
        .auth(this.token, { type: 'bearer' })
        .retry(2, (err, res) => {
          if (err) logger.info(`Retry handler found API error with ${err.code} ${err.message}`)
          return undefined // retry handler only for logging retries, not to influence retry logic
        })
        .timeout(this.timeoutConfig())
        .set(headers)
        .end((error, response) => {
          if (error) {
            logger.warn(sanitiseError(error), `Error calling ${this.name}`)
            reject(error)
          } else if (response) {
            const s = new Readable()
            // eslint-disable-next-line no-underscore-dangle,@typescript-eslint/no-empty-function
            s._read = () => {}
            s.push(response.body)
            s.push(null)
            resolve(s)
          }
        })
    })
  }
}
