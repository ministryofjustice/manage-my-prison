import assert from 'assert/strict'
import {Readable, Writable} from 'stream'
import {setTimeout} from 'timers/promises'

import {KubeConfig, Exec} from '@kubernetes/client-node'

const config = new KubeConfig()
config.loadFromDefault()
assert.equal(config.currentContext, 'live.cloud-platform.service.justice.gov.uk')

const executable = new Exec(config)

let tty = false
let stdout = process.stdout
const stderr = process.stderr

let stdin = Readable.from({
  async *[Symbol.asyncIterator]() {
    yield* process.stdin
    yield Buffer.from('\x04')
    // yield Uint8Array.from([0x04])
    await setTimeout(3000)
  },
})

const status = await new Promise((resolve, reject) => {
  executable.exec(
    'manage-my-prison-dev', 'default-backend-5fbb756488-4jjw6', null,
    ['xargs', 'echo', '123'],
    stdout, stderr, stdin, tty,
    status => {
      if (status.status !== 'Success') {
        reject(status)
      } else {
        resolve(status)
      }
    }
  ).then((webSocket) => {
    console.log('§ we have an open ws', webSocket)
    webSocket.on('error', (err) => {
      console.error('§ ws err', err)
    })
    webSocket.on('close', (num) => {
      console.error('§ ws close', num)
    })
  }).catch((err) => {
    console.error('§ err', err)
  })
})
console.log('§ status resolved', status)
console.log('§ look out for stdin’s input being returned…?')
