import chalk from 'chalk'

import {helm, releaseName} from './index.js'
import {history, HistoryRevision} from './history.js'
import {Environment, namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {confirm} from '../../lib/interactive.js'
import {Verbosity} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'

type ExactRevision = {
  revision: number
}
type DeltaRevision = {
  steps: number
}
type Revision = DeltaRevision | ExactRevision

function coerceRevision(revision: string): Revision {
  if (revision[0] === '-') {
    const steps = parseInt(revision.slice(1), 10)
    if (!isFinite(steps) || steps === 0) {
      throw new Error('Relative revision must be a whole number of steps')
    }
    return {steps}
  }
  const revisionNum = parseInt(revision, 10)
  if (!isFinite(revisionNum)) {
    throw new Error('Revision must be a whole number')
  }
  return {
    revision: revisionNum,
  }
}

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Roll back to a previous release',
  {
    requiredPositionals: [
      {
        name: 'revision',
        description: 'Revision number or number of steps to move (e.g. -2 to go back two revisions)',
        type: 'string',
        coerce: coerceRevision,
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  revision: Revision
}

export async function handler({environment, revision, verbosity}: Options): Promise<void> {
  const releases = await history(environment)

  const currentReleaseIndex = releases.findIndex(({status}) => status === 'deployed')
  const currentRelease = currentReleaseIndex >= 0 ? releases[currentReleaseIndex] : null
  if (verbosity > Verbosity.normal && currentRelease) {
    process.stderr.write(
      `Current release is ${currentRelease.revision} (version: ${chalk.green(currentRelease.appVersion)})\n`
    )
  }

  if ('revision' in revision) {
    const desiredRelease = releases.find(({revision: aRevision}) => aRevision === revision.revision)
    if (desiredRelease) {
      await rollback(environment, desiredRelease, verbosity)
    } else {
      throw new Error(`Cannot find revision ${revision.revision} in release history`)
    }
  } else {
    if (currentRelease === null) {
      throw new Error('Cannot determine current revision to count steps from')
    }
    const desiredIndex = currentReleaseIndex + revision.steps
    if (desiredIndex >= releases.length) {
      throw new Error(`Cannot roll back ${revision.steps} releases`)
    }
    const desiredRelease = releases[desiredIndex]
    await rollback(environment, desiredRelease, verbosity)
  }
}

async function rollback(environment: Environment, release: HistoryRevision, verbosity: Verbosity): Promise<void> {
  process.stderr.write(`Desired release is ${release.revision} (version: ${chalk.red(release.appVersion)})\n`)
  await confirm(
    'Are you sure you want to change to this release?',
    async () => {
      const ns = namespace(environment)
      const args = [
        'rollback', releaseName,
        '--namespace', ns,
        String(release.revision),
        '--wait', '--wait-for-jobs',
        '--timeout', '10m',
      ]
      if (verbosity > Verbosity.normal) {
        args.push('--debug')
      }
      await helm(args)
    },
    {proceedUnlessProduction: environment},
  )
}
