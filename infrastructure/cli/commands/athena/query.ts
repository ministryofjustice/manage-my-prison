import {QueryExecutionState} from '@aws-sdk/client-athena'
import chalk from 'chalk'

import {Client} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {confirm} from '../../lib/interactive.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Execute a query in Athena',
  {
    requiredPositionals: [
      {
        name: 'query',
        description: 'SQL query',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  query: string
}

export async function handler({environment, query}: Options): Promise<void> {
  await confirm('Are you sure it is safe to run this query?', async () => {
    const client = await Client.load(environment)

    process.stderr.write(`Executing query “${chalk.yellow(query)}” in “${client.databaseName}” database…\n`)
    const id = await client.startExecution(query)

    process.stderr.write(`Awaiting completion of query ${id}…\n`)
    const status = await client.executionCompletion(id)
    if (status === QueryExecutionState.SUCCEEDED) {
      const {columns, rows} = await client.collectedExecutionResults(id)
      process.stderr.write(chalk.green(`Query returned ${rows.length} results:\n`))
      printTable(rows, columns)
    } else {
      process.stderr.write(chalk.red(`Query finished with status: ${status}\n`))
    }
  })
}
