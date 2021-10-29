import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {bytes, shortDate} from '../../lib/misc.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List objects in S3',
  {
    optionalPositionals: [
      {
        name: 'prefix',
        description: 'List objects whose keys start with this',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  prefix?: string
}

export async function handler({environment, prefix}: Options): Promise<void> {
  const client = await Client.load(environment)
  process.stderr.write(`Listing “${client.bucketName}”`)
  if (prefix) {
    process.stderr.write(` with prefix '${prefix}'`)
  }
  process.stderr.write(':\n\n')
  const objects = await client.listObjects(prefix)
  if (!objects.length) {
    process.stderr.write('No objects found\n')
    return
  }
  const rows = objects.map(item => {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: item.Key!,
      modified: shortDate(item.LastModified),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      size: bytes(item.Size!),
    }
  })
  const columns = [
    {key: 'name', name: 'Name'},
    {key: 'modified', name: 'Last modified'},
    {key: 'size', name: 'Size'},
  ]
  printTable(rows, columns)
}
