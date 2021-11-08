import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {confirm} from '../../lib/interactive.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Delete S3 objects',
  {
    requiredPositionals: [
      {
        name: 'key',
        description: 'Object key',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  key: string
}

export async function handler({environment, key}: Options): Promise<void> {
  const client = await Client.load(environment)
  await confirm(`Are you sure you want to delete “${key}” from “${client.bucketName}”?`, async () => {
    await client.deleteObject(key)
  })
}
