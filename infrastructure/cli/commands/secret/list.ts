import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {shortDate} from '../../lib/misc.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List secrets in Cloud Platform',
)

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const ns = namespace(environment)
  const kubernetes = new KubernetesApi()
  const response = await kubernetes.coreApi.listNamespacedSecret(ns)
  if (!response.body.items) {
    process.stderr.write('No secrets found\n')
    return
  }
  process.stderr.write(`Secrets in ${ns}\n\n`)
  const rows = response.body.items.map(item => {
    return {
      type: item.type || '[unknown]',
      name: item.metadata?.name || '[undefined]',
      created: shortDate(item.metadata?.creationTimestamp),
      count: String(Object.keys(item.data || {}).length),
    }
  })
  const columns = [
    {key: 'name', name: 'Name'},
    {key: 'created', name: 'Created'},
    {key: 'type', name: 'Type'},
    {key: 'count', name: 'Count'},
  ]
  printTable(rows, columns)
}
