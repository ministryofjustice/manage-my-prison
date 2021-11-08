import {chartName, valuesFileName} from './index.js'
import {helm, updateHelmDependencies} from './index.js'
import {namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {Verbosity} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Lint helm chart',
  {
    options: {
      strict: {
        boolean: true,
        default: true,
        description: 'Fail on warnings',
      },
      includeSubcharts: {
        boolean: true,
        default: false,
        description: 'Lint subcharts',
      },
    },
  }
)

interface Options extends EnvironmentOptions {
  strict: boolean
  includeSubcharts: boolean
}

export async function handler({
  environment,
  verbosity,
  strict = true,
  includeSubcharts = false,
}: Options): Promise<void> {
  if (includeSubcharts) {
    await updateHelmDependencies()
  }

  const ns = namespace(environment)
  const values = valuesFileName(environment)
  const args = ['lint', '--values', values, '--namespace', ns]
  if (strict) {
    args.push('--strict')
  }
  if (includeSubcharts) {
    args.push('--with-subcharts')
  }
  if (verbosity > Verbosity.normal) {
    args.push('--debug')
  }
  await helm([...args, `./${chartName}`])
}
