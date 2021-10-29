import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {shortDateTime} from '../../lib/misc.js'
import {subprocess} from '../../lib/subprocess.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Log docker into ECR',
)

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const client = await Client.load(environment)
  const {username, password, expiresAt} = await client.getAuthorisationToken()
  process.stderr.write(
    `Logging docker into ${client.ecrDomain} as ${username} (will expire on ${shortDateTime(expiresAt)})\n`
  )
  await subprocess('docker', ['login', '--username', username, '--password-stdin', client.ecrDomain], {
    input: password,
  })
}
