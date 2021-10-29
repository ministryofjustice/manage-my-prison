import {Client} from './index.js'
import {portConfig} from './port-forward.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {Port} from '../../lib/misc.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Port-forward demo scripts for Elasticache Redis',
  {
    requiredPositionals: [
      {
        name: 'language',
        choices: ['node-redis', 'node-redis-next', 'python'],
        description: 'The language for which to show a demo local connection script',
      },
    ],
    options: {port: portConfig},
  }
)

const passwordPlaceholder = '???password???'

interface Options extends EnvironmentOptions {
  language: 'node-redis' | 'node-redis-next' | 'python'
  port: Port
}

export async function handler({environment, language, port = portConfig.default}: Options): Promise<void> {
  const client = await Client.load(environment)
  process.stderr.write(
    'First, port-forward Elasticache Redis to a local port using the `redis port-forward` command.\n' +
    client.howToGetSecret() +
    `…and replace “${passwordPlaceholder}” in scripts with this.\n` +
    'NB: Redis client must support TLS but must not check certificates as the domain will be incorrect.\n' +
    'Now connect locally with this script…\n\n'
  )
  switch (language) {
    case 'node-redis':
      return demoNodeRedis(port)
    case 'node-redis-next':
      return demoNodeRedisNext(port)
    case 'python':
      return demoPython(port)
    default:
      throw new Error(`Implementation error - unknown language "${language}"`)
  }
}

function demoNodeRedis(port: Port) {
  // for redis ^3
  process.stdout.write(`
const redis = require('redis')
const client = redis.createClient({
  password: '${passwordPlaceholder}',
  host: 'localhost',
  port: ${port},
  tls: {
    requestCert: false,
    rejectUnauthorized: false,
  },
})
client.on('error', console.error)
client.ping(redis.print)
client.keys('*', redis.print)
`.trim() + '\n')
}

function demoNodeRedisNext(port: Port) {
  // for redis ^4
  process.stdout.write(`
import {createClient} from 'redis'
;(async () => {
  const client = createClient({
    url: 'rediss://localhost:${port}',
    password: '${passwordPlaceholder}',
    socket: {
      requestCert: false,
      rejectUnauthorized: false,
    },
  })
  client.on('error', console.error)
  await client.connect()
  console.dir(await client.ping())
  console.dir(await client.keys('*'))
  await client.disconnect()
})()
`.trim() + '\n')
}

function demoPython(port: Port) {
  process.stdout.write(`
import redis
r = redis.Redis(host='localhost', password='${passwordPlaceholder}', port=${port}, ssl=True, ssl_cert_reqs=None)
r.ping()
r.keys('*')
`.trim() + '\n')
}
