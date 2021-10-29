import {ImageDetail} from '@aws-sdk/client-ecr'
import chalk from 'chalk'

import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {shortDate, shortDigest} from '../../lib/misc.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List images in ECR',
)

interface PrintableImageDetail extends ImageDetail {
  printableTags: {
    unstyledLength: number
    styledText: string
  }
}

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const client = await Client.load(environment)
  const imageDetails = await client.describeImages() as PrintableImageDetail[]
  process.stderr.write(`Listing “${client.repoName}”:\n\n`)
  if (!imageDetails.length) {
    process.stderr.write('No images found\n')
    return
  }
  imageDetails.sort((image1, image2) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [date1, date2] = [image1.imagePushedAt!, image2.imagePushedAt!]
    if (date1 > date2) {
      return -1
    }
    if (date1 < date2) {
      return 1
    }
    return 0
  })
  imageDetails.forEach(image => {
    if (!image.imageTags) {
      image.imageTags = ['[untagged]']
    }
    image.imageTags.sort()
    const separator = ', '
    const count = image.imageTags.length
    const unstyledLength = image.imageTags
      .map(tag => tag.length)
      .reduce((sum, len) => sum + len, 0) + Math.max(0, count - 1) * separator.length
    const styledText = image.imageTags
      .map(tag => chalk.green(tag))
      .join(chalk.grey(separator))
    image.printableTags = {unstyledLength, styledText}
  })
  const rows = imageDetails.map(image => {
    return {
      image: [image.printableTags.styledText, image.printableTags.unstyledLength] as [string, number],
      created: shortDate(image.imagePushedAt),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      digest: shortDigest(image.imageDigest!),
    }
  })
  const columns = [
    {key: 'image', name: 'Image'},
    {key: 'created', name: 'Created'},
    {key: 'digest', name: 'Digest'},
  ]
  printTable(rows, columns)
}
