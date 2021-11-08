import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {confirm} from '../../lib/interactive.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Delete image from ECR',
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
  const imageDetails = await client.describeImages({imageIds: [{imageTag}]})
  const image = imageDetails.length === 1 ? imageDetails[0] : null
  if (!image) {
    process.stderr.write('No images found\n')
  } else {
    await confirm('Are you sure you want to delete ECR image?', async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await client.deleteImages([image.imageDigest!])
    })
  }
}
