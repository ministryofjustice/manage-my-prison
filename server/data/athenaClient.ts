import { setTimeout } from 'timers'
import { promisify } from 'util'

import {
  AthenaClient as Client,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  StartQueryExecutionCommand,
  QueryExecutionState,
} from '@aws-sdk/client-athena'

export interface AthenaConfig {
  accessKeyId: string
  secretAccessKey: string
  workGroup: string
  database: string
  endpoint?: string
}

export default class AthenaClient {
  athena: Client

  workGroup: string

  database: string

  constructor(config: AthenaConfig) {
    this.athena = new Client({
      region: 'eu-west-2',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
    })
    this.workGroup = config.workGroup
    this.database = config.database
  }

  /**
   * Launches an SQL query in AWS Athena
   */
  async startExecution(query: string): Promise<string> {
    const command = new StartQueryExecutionCommand({
      QueryString: query,
      WorkGroup: this.workGroup,
      QueryExecutionContext: { Database: this.database },
    })
    const response = await this.athena.send(command)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return response.QueryExecutionId!
  }

  /**
   * Gets the status of a launched execution
   */
  async getExecutionStatus(id: string): Promise<QueryExecutionState> {
    const command = new GetQueryExecutionCommand({
      QueryExecutionId: id,
    })
    const response = await this.athena.send(command)
    return response.QueryExecution.Status.State as QueryExecutionState
  }

  /**
   * Awaits an execution’s completion (whether successful or not)
   */
  async executionCompletion(id: string, delay?: number): Promise<QueryExecutionState> {
    const timer = promisify(setTimeout)
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      await timer(delay || 1000)
      // eslint-disable-next-line no-await-in-loop
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

  /**
   * Yields rows from an execution’s results
   */
  async *executionResults(id: string): AsyncGenerator<string[]> {
    const command = new GetQueryResultsCommand({
      QueryExecutionId: id,
    })
    const response = await this.athena.send(command)
    // eslint-disable-next-line no-restricted-syntax
    for (const row of response.ResultSet.Rows) {
      yield row.Data.map(datum => datum.VarCharValue)
    }
  }

  /**
   * Creates a table in AWS Athena from an S3 bucket path with provided columns
   * The source data is expected to be in CSV form with 1 header row
   */
  async createCSVTable(tableName: string, s3Location: string, columns: string[]): Promise<boolean> {
    const query = `
    CREATE EXTERNAL TABLE IF NOT EXISTS ${tableName} (
      ${columns.join(',\n')}
    )
    ROW FORMAT DELIMITED
      FIELDS TERMINATED BY ','
      ESCAPED BY '\\\\'
      LINES TERMINATED BY '\\n'
    STORED AS TEXTFILE
    LOCATION '${s3Location}'
    TBLPROPERTIES ("skip.header.line.count"="1")
    ;
    `
    const id = await this.startExecution(query.trim())
    const status = await this.executionCompletion(id)
    return status === QueryExecutionState.SUCCEEDED
  }

  /**
   * Deletes a table in AWS Athena
   */
  async dropTable(tableName: string): Promise<boolean> {
    const id = await this.startExecution(`DROP TABLE IF EXISTS ${tableName};`)
    const status = await this.executionCompletion(id)
    return status === QueryExecutionState.SUCCEEDED
  }
}