import {releaseName, helm} from './index.js'
import {namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {shortDateTime, Verbosity} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Check status of release',
)

export async function handler({environment, verbosity}: EnvironmentOptions): Promise<void> {
  const ns = namespace(environment)
  const args = ['list', '--namespace', ns, '--output', 'json', '--all']
  if (verbosity > Verbosity.normal) {
    args.push('--debug')
  }
  const list = await helm(args, {output: 'object'}) as any[]
  const rows = list
    .filter(item => item.name === releaseName)
    .map(item => {
      const {revision, updated, status} = item
      // strip off time zone name from end
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let updatedDate = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)? [+-]\d{4})/.exec(updated)![0]
      updatedDate = shortDateTime(updatedDate)
      return {revision, updated: updatedDate, status}
    })
    .sort(({revision: revision1}, {revision: revision2}) => revision2 - revision1)
  printTable(rows, [
    {name: 'Updated', key: 'updated'},
    {name: 'Revision', key: 'revision'},
    {name: 'Status', key: 'status'},
  ])
}
