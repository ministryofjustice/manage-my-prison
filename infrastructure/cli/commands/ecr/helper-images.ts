import * as fs from 'fs/promises'
import * as path from 'path'

import {checkDockerError, Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {getMainPath} from '../../lib/paths.js'
import {subprocess} from '../../lib/subprocess.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Build and push helper images into ECR',
  {
    options: {
      push: {
        boolean: true,
        default: true,
        description: 'Push to ECR',
      },
    },
  }
)

interface Options extends EnvironmentOptions {
  push?: boolean
}

export async function handler({environment, push = true}: Options): Promise<void> {
  const rootDir = getMainPath()
  const imagesDir = path.join(rootDir, 'infrastructure', 'helper-images')
  const images: [string, string][] = []
  for await (const entry of await fs.opendir(imagesDir)) {
    if (entry.isDirectory()) {
      const imageDir = path.join(imagesDir, entry.name)
      try {
        const stat = await fs.stat(path.join(imageDir, 'Dockerfile'))
        if (stat.isFile()) {
          const imageName = path.basename(imageDir)
          process.stderr.write(`Building "${imageName}" docker image…`)
          await subprocess('docker', [
            'build', '--pull', '--rm', '--progress', 'plain', '--tag', imageName, '.',
          ], {cwd: imageDir})
          images.push([imageName, imageDir])
        }
      } catch (e) {
        // Dockerfile does not exist
      }
    }
  }
  if (push) {
    const client = await Client.load(environment)
    for (const [imageName, imageDir] of images) {
      const fullImageName = `${client.repoUrl}:${imageName}`
      process.stderr.write(`Retagging "${imageName}" docker image…`)
      await subprocess('docker', ['tag', imageName, fullImageName], {cwd: imageDir})
      await subprocess('docker', ['rmi', imageName], {cwd: imageDir})

      try {
        process.stderr.write(`Pushing "${imageName}" docker image to ECR…`)
        await subprocess('docker', ['push', fullImageName], {cwd: imageDir, exitOnError: false})
      } catch (e) {
        checkDockerError(environment, e)
      }
    }
  }
}
