import {helm, releaseName} from './index.js'
import {namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {shortDateTime} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List history of releases',
)

type Release = {
  revision: number
  updated: string
  status: string
  chart: string
  app_version: string
  description: string
}

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const ns = namespace(environment)
  const args = ['history', releaseName, '--namespace', ns, '--output', 'json']
  const list = await helm(args, {output: 'object'}) as Release[]
  const rows = list
    .sort(({revision: revision1}, {revision: revision2}) => {
      return revision2 - revision1
    })
    .map(item => {
      const {revision, updated, status, app_version: appVersion, description} = item
      // strip off time zone name from end
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let updatedDate = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z| [+-]\d{4})?)/.exec(updated)![0]
      updatedDate = shortDateTime(updatedDate)
      return {revision: String(revision), updated: updatedDate, status, appVersion, description}
    })
  printTable(rows, [
    {name: 'Updated', key: 'updated'},
    {name: 'Revision', key: 'revision'},
    {name: 'Status', key: 'status'},
    {name: 'Version', key: 'appVersion'},
    {name: 'Description', key: 'description'},
  ])
}
