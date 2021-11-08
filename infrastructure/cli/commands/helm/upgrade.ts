import {chartName, releaseName, coerceVersion, valuesFileName} from './index.js'
import {helm, updateHelmDependencies} from './index.js'
import {namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {confirm} from '../../lib/interactive.js'
import {Verbosity} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Upgrade/install helm chart',
  {
    requiredPositionals: [
      {
        name: 'version',
        description: 'App version / image tag',
        coerce: coerceVersion,
      },
    ],
    options: {
      'dry-run': {
        boolean: true,
        default: true,
        description: 'Do not make changes',
      },
    },
  }
)

interface Options extends EnvironmentOptions {
  version: string
  dryRun: boolean
}

export async function handler({environment, version, dryRun = true, verbosity}: Options): Promise<void> {
  await updateHelmDependencies()

  const ns = namespace(environment)
  const values = valuesFileName(environment)
  const args = [
    'upgrade',
    '--install',
    '--namespace', ns,
    '--reset-values',
    '--values', values,
    '--set', `generic-service.image.tag=${version}`,
    '--history-max', '10',
  ]
  if (dryRun) {
    args.push('--dry-run')
  }
  if (verbosity > Verbosity.normal) {
    args.push('--debug')
  }
  const callback = async () => {
    await helm([...args, releaseName, `./${chartName}`])
  }
  if (dryRun) {
    // dry run does not need confirmation
    return await callback()
  }
  await confirm('Are you sure you want to upgrade the release?', callback, {proceedUnlessProduction: environment})
}
