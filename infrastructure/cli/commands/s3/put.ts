import * as fs from 'fs/promises'
import * as path from 'path'

import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {collect} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Upload objects to S3',
  {
    requiredPositionals: [
      {
        name: 'key',
        description: 'Object key',
      },
    ],
    optionalPositionals: [
      {
        name: 'open-from',
        description: 'File to upload (defaults to stdin)',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  key: string
  openFrom?: string
}

export async function handler({environment, key, openFrom}: Options): Promise<void> {
  const client = await Client.load(environment)
  // eslint-disable-next-line init-declarations
  let content
  if (openFrom) {
    const openFromPath = path.resolve(openFrom)
    const readHandle = await fs.open(openFromPath, 'r')
    content = await readHandle.readFile()
  } else {
    const chunks: any[] = await collect(process.stdin)
    content = Buffer.concat(chunks)
  }
  await client.putObject(key, content)
}
