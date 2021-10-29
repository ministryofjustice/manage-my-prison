import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {shortDate} from '../../lib/misc.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List tables in Athena',
)

export async function handler({environment}: EnvironmentOptions): Promise<void> {
  const client = await Client.load(environment)
  process.stderr.write(`Listing tables in “${client.databaseName}” database:\n\n`)
  const objects = await client.listTableMetadata()
  if (!objects.length) {
    process.stderr.write('No tables found\n')
    return
  }
  const rows = objects.map(item => {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: item.Name!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      created: shortDate(item.CreateTime!),
      columns: (item.Columns || [])
        .map((column) => `${column.Name} ${column.Type}`)
        .join(', '),
    }
  })
  const columns = [
    {key: 'name', name: 'Table'},
    {key: 'created', name: 'Created'},
    {key: 'columns', name: 'Columns'},
  ]
  printTable(rows, columns)
}
