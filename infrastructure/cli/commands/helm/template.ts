import {chartName, releaseName, valuesFileName} from './index.js'
import {helm, updateHelmDependencies} from './index.js'
import {getDeploymentVersion} from '../app/index.js'
import {namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {Verbosity} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Render helm chart',
)

export async function handler({environment, verbosity}: EnvironmentOptions): Promise<void> {
  await updateHelmDependencies()

  const ns = namespace(environment)
  const values = valuesFileName(environment)

  // falls back to default placeholder value in generic-service subchart
  const deployedAppVersion = await getDeploymentVersion(ns) || 'app_version'

  const args = [
    'template',
    '--namespace', ns,
    '--values', values,
    '--set', `generic-service.image.tag=${deployedAppVersion}`,
    '--include-crds',
    '--render-subchart-notes',
    '--dry-run',
    '--validate',
  ]
  // TODO: --is-upgrade vs. --dry-run ??
  if (verbosity > Verbosity.normal) {
    args.push('--debug')
  }
  await helm([...args, releaseName, `./${chartName}`])
}
