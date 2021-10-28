import bunyan from 'bunyan'
import bunyanFormat from 'bunyan-format'
import type { SuperAgentRequest, Plugin } from 'superagent'

export const defaultLevel = 'debug'
const formatOut = bunyanFormat({ outputMode: 'short', color: true })

const logger = bunyan.createLogger({ name: 'Manage My Prison', stream: formatOut, level: defaultLevel })

/**
 * Overrides the logging level for a block of sync code
 */
export function overrideLoggerSync<T>(syncFunc: () => T, level: bunyan.LogLevel = 'fatal'): T {
  const oldLevel = logger.level()
  logger.level(level)
  const response: T = syncFunc()
  logger.level(oldLevel)
  return response
}

/**
 * Overrides the logging level for a block of async code
 * NB: likely affects other "concurrent" code
 */
export async function overrideLoggerAsync<T>(
  asyncFunc: () => Promise<T>,
  level: bunyan.LogLevel = 'fatal'
): Promise<T> {
  const oldLevel = logger.level()
  logger.level(level)
  const response: T = await asyncFunc()
  logger.level(oldLevel)
  return response
}

/**
 * Overrides the logging level for individual superagent/supertest requests
 * NB: likely affects other "concurrent" code
 */
export function overrideLoggerForRequest(level: bunyan.LogLevel = 'fatal'): Plugin {
  return (request: SuperAgentRequest) => {
    const oldLevel = logger.level()
    logger.level(level)
    request.on('response', () => logger.level(oldLevel))
    request.on('error', () => logger.level(oldLevel))
  }
}

export default logger
