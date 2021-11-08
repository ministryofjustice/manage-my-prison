import {TagStatus} from '@aws-sdk/client-ecr'

import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Clean up images in ECR',
  {
    requiredPositionals: [
      {
        name: 'strategy',
        choices: ['untagged'],
        description: 'Which images should be deleted?',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  strategy: 'untagged'
}

export async function handler({environment, strategy}: Options): Promise<void> {
  const client = await Client.load(environment)
  switch (strategy) {
    case 'untagged':
      await cleanUntagged(client)
      break
    default:
      throw new Error(`Implementation error - unknown strategy "${strategy}"`)
  }
}

async function cleanUntagged(client: Client): Promise<void> {
  const imageDetails = await client.describeImages({filter: {tagStatus: TagStatus.UNTAGGED}})
  if (!imageDetails.length) {
    process.stderr.write('No untagged images found\n')
  } else {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const imageDigests = imageDetails.map((image) => image.imageDigest!)
    await client.deleteImages(imageDigests)
  }
}
