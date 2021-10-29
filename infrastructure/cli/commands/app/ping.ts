import chalk from 'chalk'

import {remoteRequest} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Ping application',
)

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const responses = await remoteRequest(environment, '/ping', {output: 'object'}) as {
    [pod: string]: {status: string}
  }
  if (Object.values(responses).every((response) => response.status === 'UP')) {
    process.stderr.write(chalk.green('All pods responded\n'))
  } else {
    process.stderr.write(chalk.red('Some pods did not respond!\n'))
  }
  console.log(responses)
}
