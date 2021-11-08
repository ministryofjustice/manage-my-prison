import {Client} from './index.js'
import {Client as EcrClient} from '../ecr/index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {namespace} from '../../lib/cluster.js'
import {confirm} from '../../lib/interactive.js'
import {Port} from '../../lib/misc.js'

export const portConfig = {
  default: 6379,
  type: 'number' as const,
  description: 'Local port to forward to',
}

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Port-forward Elasticache Redis to a local port',
  {
    options: {port: portConfig},
  }
)

interface Options extends EnvironmentOptions {
  port: Port
}

export async function handler({environment, port = portConfig.default}: Options): Promise<void> {
  await confirm(
    'Connect to production resource?',
    async () => {
      const ns = namespace(environment)
      const client = await Client.load(environment)
      const ecrClient = await EcrClient.load(environment)
      process.stderr.write(
        `Opening local port ${port} to Elasticache Redis in ${environment} environment…\n` +
        client.howToGetSecret() +
        'NB: Redis client must support TLS but must not check certificates as the domain will be incorrect.\n'
      )
      await ecrClient.runPortForwardPod(ns, port, client.primaryEndpointAddress, 6379)
    },
    {proceedUnlessProduction: environment}
  )
}
