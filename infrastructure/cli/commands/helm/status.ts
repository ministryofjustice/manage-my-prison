import {helm, releaseName} from './index.js'
import {namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {shortDateTime} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Check status of current release',
)

/**
 * Type returned by `helm list` command
 */
type Release = {
  name: string
  namespace: string
  revision: string
  updated: string
  status: string
  chart: string
  app_version: string
}

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const ns = namespace(environment)
  const args = ['list', '--namespace', ns, '--output', 'json', '--all']
  const list = await helm(args, {output: 'object'}) as Release[]
  const rows = list
    .filter(item => item.name === releaseName)
    .map(item => {
      const {revision, updated, status, app_version: appVersion} = item
      // strip off time zone name from end
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let updatedDate = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z| [+-]\d{4})?)/.exec(updated)![0]
      updatedDate = shortDateTime(updatedDate)
      return {revision, updated: updatedDate, status, appVersion}
    })
    .sort((revision1, revision2) => {
      return parseInt(revision2.revision, 10) - parseInt(revision1.revision, 10)
    })
  printTable(rows, [
    {name: 'Updated', key: 'updated'},
    {name: 'Revision', key: 'revision'},
    {name: 'Status', key: 'status'},
    {name: 'Version', key: 'appVersion'},
  ])
}
