import assert from 'assert/strict'

import {KubeConfig, Exec} from '@kubernetes/client-node'
import {CoreV1Api, AppsV1Api} from '@kubernetes/client-node'

const config = new KubeConfig()
config.loadFromDefault()
assert.equal(config.currentContext, 'live.cloud-platform.service.justice.gov.uk')

const coreApi = config.makeApiClient(CoreV1Api)
const appsV1Api = config.makeApiClient(AppsV1Api)

const executable = new Exec(config)

let tty = false
let stdin = process.stdin
let stdout = process.stdout
const stderr = process.stderr

const status = await new Promise(async (resolve, reject) => {
  const webSocket = await executable.exec(
    'manage-my-prison-dev', 'manage-my-prison-bff4cd4d7-x5m95', null,
    ['xargs', 'echo', '123'],
    stdout, stderr, stdin, tty,
    status => {
      if (status.status !== 'Success') {
        reject(status)
      } else {
        resolve(status)
      }
    }
  )
  console.log('we have an open ws', webSocket)
})
console.log('status resolved', status)
console.log('look out for stdin’s input being returned…?')
