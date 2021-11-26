import {helm, releaseName} from './index.js'
import {Environment, namespace} from '../../lib/cluster.js'
import {makeCommand} from '../../lib/command.js'
import {shortDateTime} from '../../lib/misc.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List history of releases',
)

/**
 * Type returned by `helm history` command
 */
type Revision = {
  revision: number
  updated: string
  status: string
  chart: string
  app_version: string
  description: string
}

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const rows = (await history(environment))
    .map(({revision, updated, status, appVersion, description}) => {
      const updatedDate = shortDateTime(updated)
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

/**
 * Parsed revision
 */
export type HistoryRevision = {
  revision: number
  updated: Date
  status: string
  appVersion: string
  description: string
}

export async function history(environment: Environment): Promise<HistoryRevision[]> {
  const ns = namespace(environment)
  const args = ['history', releaseName, '--namespace', ns, '--output', 'json']
  const list = await helm(args, {output: 'object'}) as Revision[]
  return list
    .sort((revision1, revision2) => {
      return revision2.revision - revision1.revision
    })
    .map(item => {
      const {revision, updated, status, app_version: appVersion, description} = item
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const updatedDate = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z| [+-]\d{4})?)/.exec(updated)![0]
      return {revision, updated: new Date(updatedDate), status, appVersion, description}
    })
}
