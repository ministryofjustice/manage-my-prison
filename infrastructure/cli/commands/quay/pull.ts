import {quayUrl} from '../quay/index.js'
import {makeCommand} from '../../lib/command.js'
import {getMainPath} from '../../lib/paths.js'
import {subprocess} from '../../lib/subprocess.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Pull main application Docker image from quay.io',
  {
    takesEnvironment: false,
    optionalPositionals: [
      {
        name: 'version',
        description: 'Image version to pull (defaults to "latest")',
      },
    ],
  }
)

export async function handler({version = 'latest'}: {version?: string} = {}): Promise<void> {
  const imageTag = `${quayUrl}:${version}`
  await subprocess('docker', ['pull', imageTag], {cwd: getMainPath()})
}
