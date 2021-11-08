import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {subprocess} from '../../lib/subprocess.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Log docker out of ECR',
)

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const client = await Client.load(environment)
  await subprocess('docker', ['logout', client.ecrDomain])
}
