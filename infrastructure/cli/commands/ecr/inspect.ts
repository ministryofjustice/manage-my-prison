import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {shortDate} from '../../lib/misc.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Get image details from ECR',
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
    const tags = image.imageTags || []
    tags.sort()
    process.stderr.write(
      `Registry:  id=${image.registryId} name=${image.repositoryName}\n` +
      `Pushed at: ${shortDate(image.imagePushedAt)}\n` +
      `Size:      ${image.imageSizeInBytes}\n` +
      `Digest:    ${image.imageDigest}\n` +
      `Tags:      ${tags.join(', ')}\n`
    )
  }
}
