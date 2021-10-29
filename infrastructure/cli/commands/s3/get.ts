import {once} from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'

import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Download objects from S3',
  {
    requiredPositionals: [
      {
        name: 'key',
        description: 'Object key',
      },
    ],
    optionalPositionals: [
      {
        name: 'save-to',
        description: 'File to save to (defaults to stdout)',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  key: string
  saveTo?: string
}

export async function handler({environment, key, saveTo}: Options): Promise<void> {
  const client = await Client.load(environment)
  const {lastModified, contentType, encoding, metadata, content} = await client.getObject(key)

  process.stderr.write(
    `Downloading “${key}” from “${client.bucketName}”: contentType=${contentType} encoding=${encoding}\n`
  )
  if (metadata) {
    process.stderr.write('Metadata: ')
    process.stderr.write(JSON.stringify(metadata))
    process.stderr.write('\n')
  }

  if (saveTo) {
    const saveToPath = path.resolve(saveTo)
    const saveToHandle = await fs.open(saveToPath, 'w')
    for await (const chunk of content) {
      await saveToHandle.write(chunk)
      // TODO: await drain if no bytes written?
    }
    if (lastModified) {
      await fs.utimes(saveToPath, lastModified.getTime(), lastModified.getTime())
    }
  } else {
    for await (const chunk of content) {
      const succeeded = process.stdout.write(chunk)
      if (!succeeded) {
        await once(process.stdout, 'drain')
      }
    }
  }
}
