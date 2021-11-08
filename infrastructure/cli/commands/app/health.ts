import chalk from 'chalk'

import {remoteRequest} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Check health of application',
)

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const responses = await remoteRequest(environment, '/health', {output: 'object'}) as {
    [pod: string]: {healthy: boolean}
  }
  if (Object.values(responses).every(response => response.healthy)) {
    process.stderr.write(chalk.green('All pods are healthy\n'))
  } else {
    process.stderr.write(chalk.red('Some pods are not healthy!\n'))
  }
  console.log(responses)
}
