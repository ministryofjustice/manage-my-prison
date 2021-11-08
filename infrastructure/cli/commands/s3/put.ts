import * as fs from 'fs'
import * as path from 'path'
import {Readable} from 'stream'

import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
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
  let readableContent: Readable
  if (openFrom) {
    const openFromPath = path.resolve(openFrom)
    readableContent = fs.createReadStream(openFromPath)
  } else {
    readableContent = process.stdin
  }
  await client.putObject(key, readableContent)
}
