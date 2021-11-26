import assert from 'assert/strict'

import {appName} from './app.js'

// kubernetes cluster details
export const CONTEXT = 'live.cloud-platform.service.justice.gov.uk'

export type Environment = 'dev'  // TODO: will become: 'dev' | 'prod'
export const ENVIRONMENTS: Environment[] = ['dev']  // TODO: will become: ['dev', 'prod']

export type Deployment = (typeof appName) | string
export const DEPLOYMENT: Deployment = appName

// AWS region
export const REGION = 'eu-west-2'

/**
 * Converts an environment name into a Cloud Platform kubernetes namespace
 */
export function namespace(environment: Environment): string {
  assert.ok(ENVIRONMENTS.includes(environment), `Unknown environment ${environment}`)
  return `${appName}-${environment}`
}

/**
 * Converts an environment name into domain name
 */
export function ingressUrl(environment: Environment): string {
  assert.ok(ENVIRONMENTS.includes(environment), `Unknown environment ${environment}`)
  switch (environment) {
    case 'dev':
      return 'manage-my-prison-dev.prison.service.justice.gov.uk'
    default:
      throw new Error(`Implementation error - missing ingress url for "${environment}"`)
  }
}
