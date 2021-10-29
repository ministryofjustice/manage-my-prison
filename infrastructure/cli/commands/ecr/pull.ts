import {Client, checkDockerError} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {subprocess} from '../../lib/subprocess.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Pull image from ECR',
  {
    requiredPositionals: [
      {
        name: 'imageTag',
        description: 'Image tag',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  imageTag: string
}

export async function handler({environment, imageTag}: Options): Promise<void> {
  const client = await Client.load(environment)
  try {
    await subprocess('docker', ['pull', `${client.repoUrl}:${imageTag}`], {exitOnError: false})
  } catch (e) {
    checkDockerError(environment, e)
  }
}
