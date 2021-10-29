import {setTimeout} from 'timers/promises'

import {AthenaClient} from '@aws-sdk/client-athena'
import {paginateListTableMetadata} from '@aws-sdk/client-athena'
import {GetQueryExecutionCommand, GetQueryResultsCommand, StartQueryExecutionCommand} from '@aws-sdk/client-athena'
import {QueryExecutionState, TableMetadata} from '@aws-sdk/client-athena'

import {Environment, REGION, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'

export const description = 'Manage Athena database'

type ResultsColumn = string
type ResultsRow = {
  [name: string]: string
}

export class Client {
  static readonly secretName = 'athena'

  static async load(environment: Environment): Promise<Client> {
    const ns = namespace(environment)
    const kubernetes = new KubernetesApi()
    const secret = await kubernetes.getDecodedSecret(ns, Client.secretName)
    if (!secret) {
      throw new Error(`Cannot find Athena secret in ${ns}`)
    }
    const {
      access_key_id: accessKeyId,
      secret_access_key: secretAccessKey,
      workgroup,
      database_name: databaseName,
    } = secret
    const athenaClient = new AthenaClient({
      region: REGION,
      credentials: {accessKeyId, secretAccessKey},
    })
    return new Client(environment, workgroup, databaseName, athenaClient)
  }

  private constructor(
    readonly environment: Environment,
    readonly workgroup: string,
    readonly databaseName: string,
    private readonly athenaClient: AthenaClient,
  ) {}

  async listTableMetadata(): Promise<TableMetadata[]> {
    const paginator = paginateListTableMetadata({client: this.athenaClient}, {
      CatalogName: 'AwsDataCatalog',
      DatabaseName: this.databaseName,
    })
    const list = []
    for await (const response of paginator) {
      const rows = response.TableMetadataList || []
      list.push(...rows)
    }
    return list
  }

  async startExecution(query: string): Promise<string> {
    const command = new StartQueryExecutionCommand({
      QueryString: query,
      WorkGroup: this.workgroup,
      QueryExecutionContext: {Database: this.databaseName},
    })
    const response = await this.athenaClient.send(command)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return response.QueryExecutionId!
  }

  async getExecutionStatus(id: string): Promise<QueryExecutionState> {
    const command = new GetQueryExecutionCommand({
      QueryExecutionId: id,
    })
    const response = await this.athenaClient.send(command)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return response.QueryExecution!.Status!.State as QueryExecutionState
  }

  async executionCompletion(id: string, delay = 500): Promise<QueryExecutionState> {
    for (;;) {
      await setTimeout(delay)
      const status = await this.getExecutionStatus(id)
      if (
        status === QueryExecutionState.SUCCEEDED ||
        status === QueryExecutionState.FAILED ||
        status === QueryExecutionState.CANCELLED
      ) {
        return status
      }
    }
  }

  async *executionResults(id: string): AsyncGenerator<string[], void, void> {
    let yieldedColumns = false
    let nextToken: string | undefined = undefined

    do {
      const command: GetQueryResultsCommand = new GetQueryResultsCommand({
        QueryExecutionId: id,
        MaxResults: 1000,
        NextToken: nextToken,
      })
      const response = await this.athenaClient.send(command)
      nextToken = response.NextToken
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const results = response.ResultSet!

      if (!yieldedColumns) {
        yieldedColumns = true
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const columns = results.ResultSetMetadata!.ColumnInfo!
          .map(column => column.Name as string)
        yield columns
      }

      const rows = results.Rows || []
      for (const row of rows) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        yield row.Data!.map(datum => datum.VarCharValue!)
      }
    } while (nextToken)
  }

  async collectedExecutionResults(id: string): Promise<{columns: ResultsColumn[], rows: ResultsRow[]}> {
    const results = this.executionResults(id)
    const columns = (await results.next()).value as ResultsColumn[]
    const rows: ResultsRow[] = []
    await results.next()  // skip column names
    for await (const row of results) {
      const pairs = row.map((value, index) => [columns[index], value])
      rows.push(Object.fromEntries(pairs))
    }
    return {columns, rows}
  }
}
