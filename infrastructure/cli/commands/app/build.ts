import {currentCommitHash} from './index.js'
import {Client} from '../ecr/index.js'
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
  }
)

export async function handler(): Promise<void> {
  const buildDate = shortDate(Date.now())
  const ciBuildNumber = 0  // building locally, so no CircleCI build number exists
  const commitHash = await currentCommitHash()
  const shortCommitHash = commitHash.slice(0, 7)
  const appVersion = `${buildDate}.${ciBuildNumber}.${shortCommitHash}`

  const imageTag = `${Client.quayUrl}:${appVersion}`

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
}
