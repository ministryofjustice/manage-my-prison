import superagent from 'superagent'
import type { Request } from 'express'

import config from '../config.js'
import getSanitisedError from '../sanitisedError.js'
import type { UnsanitisedError } from '../sanitisedError.js'
import logger from '../../logger.js'

function getApiClientToken(token: string) {
  return superagent
    .post(`${config.apis.tokenVerification.url}/token/verify`)
    .auth(token, { type: 'bearer' })
    .timeout(config.apis.tokenVerification.timeout)
    .then(response => Boolean(response.body && response.body.active))
    .catch((error: UnsanitisedError) => {
      logger.error(getSanitisedError(error), 'Error calling tokenVerificationApi')
    })
}

export type TokenVerifier = (request: Request) => Promise<boolean | void>

const tokenVerifier: TokenVerifier = async request => {
  const { user, verified } = request

  if (!config.apis.tokenVerification.enabled) {
    logger.debug('Token verification disabled, returning token is valid')
    return true
  }

  if (verified) {
    return true
  }

  logger.debug(`token request for user "${user.username}'`)

  const result = await getApiClientToken(user.token)
  if (result) {
    request.verified = true
  }
  return result
}

export default tokenVerifier
