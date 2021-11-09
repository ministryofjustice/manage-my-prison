import chalk from 'chalk'

import {currentCommitHash} from './index.js'
import {quayUrl} from '../quay/index.js'
import {githubRepository} from '../../lib/app.js'
import {makeCommand} from '../../lib/command.js'
import {shortDate} from '../../lib/misc.js'
import {getMainPath} from '../../lib/paths.js'
import {subprocess} from '../../lib/subprocess.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Build main application Docker image',
  {
    takesEnvironment: false,
    options: {
      'tag-latest': {
        boolean: true,
        description: 'Tag built image as latest version',
      },
    },
  }
)

export async function handler({tagLatest = false}: {tagLatest?: boolean} = {}): Promise<void> {
  const buildDate = shortDate(Date.now())
  const ciBuildNumber = 0  // building locally, so no CircleCI build number exists
  const commitHash = await currentCommitHash()
  const shortCommitHash = commitHash.slice(0, 7)
  const appVersion = `${buildDate}.${ciBuildNumber}.${shortCommitHash}`

  const imageTag = `${quayUrl}:${appVersion}`
  const latestImageTag = `${quayUrl}:latest`

  const args = [
    'build',
    '--pull',
    '--rm',
    '--progress', 'plain',
    '--tag', imageTag,
    ...[
      `BUILD_NUMBER=${appVersion}`,
      `GIT_REF=${commitHash}`,
    ].map(buildArg => ['--build-arg', buildArg]).flat(),
    ...[
      'maintainer=dps-hmpps@digital.justice.gov.uk',
      `app.version=${appVersion}`,
      `build.version=${appVersion}`,
      `build.number=${ciBuildNumber}`,
      `build.url=${githubRepository}/commit/${commitHash}`,
      // NB: when built by CircleCI, this would be the build URL:
      // `build.url=${circleCiUrl}/${ciBuildNumber}`,
      `build.gitref=${commitHash}`,
    ].map(label => ['--label', label]).flat(),
    '.',
  ]
  await subprocess('docker', args, {cwd: getMainPath()})
  if (tagLatest) {
    await subprocess('docker', [
      'tag',
      imageTag,
      latestImageTag,
    ], {cwd: getMainPath()})
  }
  process.stderr.write(chalk.yellow('Cannot help with pushing image to quay.io – credentials not known') + '\n')
}
