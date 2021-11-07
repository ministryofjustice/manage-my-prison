import assert from 'assert/strict'
import {Readable, Writable} from 'stream'
import {setTimeout} from 'timers/promises'

import {KubeConfig, Exec} from '@kubernetes/client-node'

assert.ok(process.argv.length > 2, 'needs command args')

const podNode = 'manage-my-prison-bff4cd4d7-x5m95'
const podPlain = 'default-backend-5fbb756488-4jjw6'

const config = new KubeConfig()
config.loadFromDefault()
assert.equal(config.currentContext, 'live.cloud-platform.service.justice.gov.uk')

const executable = new Exec(config)

const tty = false
const stdin = process.stdin
const stdout = process.stdout
const stderr = process.stderr

const command = ['sh', '-e', '-u', '+x', '-c', process.argv.slice(2).join(' ')]

const status = await new Promise((resolve, reject) => {
  executable.exec(
    'manage-my-prison-dev', podPlain, null,
    command,
    stdout, stderr, stdin, tty,
    status => {
      if (status.status !== 'Success') {
        reject(status)
      } else {
        resolve(status)
      }
    }
  ).then((webSocket) => {
    console.log('§ we have an open ws', webSocket.protocol)
    webSocket.on('error', (err) => {
      console.error('§ ws err', err)
      reject(err)
    })
    webSocket.on('close', (num) => {
      console.error('§ ws close', num)
    })
  }).catch((err) => {
    console.error('§ err', err)
    reject(err)
  })
})
console.log('§ status resolved', status)

/*
const tty = true
const stdin = Readable.from({
  async *[Symbol.asyncIterator]() {
    console.log('§ stdin yield*')
    yield* process.stdin
    console.log('§ ^D')
    yield Buffer.from('\x04')
    // yield Buffer.from('\x04')
    // yield Uint8Array.from([0x04])
    console.log('§ wait to end stdin')
    await setTimeout(3000)
  },
})

class WrappedWritable extends Writable {
  constructor(name, out) {
    super({
      write(chunk, encoding, callback) {
        console.log('±1 write to', name, '«' + chunk.toString() + '»', encoding)
        // out.write(chunk, encoding, callback)
        if (callback) {
          callback()
        }
      },
      writev(chunks, callback) {
        console.log('±2 writev to', name)
        for (const chunk of chunks) {
          this.write(chunk.chunk, chunk.encoding)
        }
        callback()
      },
      final(callback) {
        console.log('± final', name)
        // out.final(callback)
        callback()
      },
      emitClose: true,
    })
    // this.out = out
  }
}

const stdout = new WrappedWritable('stdout', process.stdout)
const stderr = new WrappedWritable('stderr', process.stderr)

const status = await new Promise((resolve, reject) => {
  executable.exec(
    'manage-my-prison-dev', podPlain, null,
    process.argv.slice(2), // ['xargs', 'echo', '123'],
    stdout, stderr, stdin, tty,
    status => {
      if (status.status !== 'Success') {
        reject(status)
      } else {
        resolve(status)
      }
    }
  ).then((webSocket) => {
    console.log('§ we have an open ws', webSocket.protocol)
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
*/


/*
import * as k8s from '@kubernetes/client-node'

const command = process.argv[2]

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const exec = new k8s.Exec(kc)
await exec.exec(
  'manage-my-prison-dev', podPlain, 'default-backend', command,
  process.stdout, process.stderr, process.stdin,
  true,
  (status) => {
    console.log('status', JSON.stringify(status))
  }
)
*/
