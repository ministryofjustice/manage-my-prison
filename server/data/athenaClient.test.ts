import type { GetQueryExecutionOutput, GetQueryResultsOutput, StartQueryExecutionOutput } from '@aws-sdk/client-athena'
import { QueryExecutionState as ExecutionState } from '@aws-sdk/client-athena'

import AthenaClient, { AthenaConfig } from './athenaClient'
import { S3BucketConfig } from './s3Client'

const bucketConfig = { bucket: 'bucket1' } as S3BucketConfig
const athenaConfig = {
  workGroup: 'work-group-1',
  database: 'database_1',
} as AthenaConfig

const athena = {
  send: jest.fn().mockReturnThis(),
}

jest.mock('@aws-sdk/client-athena', () => {
  const { QueryExecutionState, GetQueryExecutionCommand, GetQueryResultsCommand, StartQueryExecutionCommand } =
    jest.requireActual('@aws-sdk/client-athena')
  return {
    AthenaClient: jest.fn(() => athena),
    QueryExecutionState,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
    StartQueryExecutionCommand,
  }
})

describe('AthenaClient', () => {
  let athenaClient: AthenaClient

  const fakeQueryId = '11111111-2222-3333-4444-555555555555'

  function fakeStartQueryExecution(): StartQueryExecutionOutput {
    return {
      QueryExecutionId: fakeQueryId,
    }
  }

  function fakeQueryExecutionStatus(status: ExecutionState): GetQueryExecutionOutput {
    return {
      QueryExecution: {
        QueryExecutionId: fakeQueryId,
        WorkGroup: athenaConfig.workGroup,
        Status: { State: status },
      },
    }
  }

  beforeEach(() => {
    athenaClient = new AthenaClient(athenaConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('startExecution()', () => {
    it('passes parameters to Athena', async () => {
      const awsResponse = fakeStartQueryExecution()
      athena.send.mockResolvedValue(awsResponse)
      const sqlQuery = 'SELECT * FROM prison_population;'
      const response = await athenaClient.startExecution(sqlQuery)
      expect(response).toEqual(fakeQueryId)
      // expect the first parameter of the first call to include work group and database
      const [command] = athena.send.mock.calls[0]
      const { QueryString, WorkGroup, QueryExecutionContext } = command.input
      const { Database } = QueryExecutionContext
      expect(QueryString).toEqual(sqlQuery)
      expect(WorkGroup).toEqual(athenaConfig.workGroup)
      expect(Database).toEqual(athenaConfig.database)
    })
  })

  describe('getExecutionStatus()', () => {
    it('returns execution status', async () => {
      const awsResponse = fakeQueryExecutionStatus(ExecutionState.SUCCEEDED)
      athena.send.mockResolvedValue(awsResponse)
      const response = await athenaClient.getExecutionStatus(fakeQueryId)
      expect(response).toEqual(ExecutionState.SUCCEEDED)
    })
  })

  describe.each([
    ['waits until the execution is successful', ExecutionState.SUCCEEDED],
    ['waits until the execution is cancelled', ExecutionState.CANCELLED],
    ['waits until the execution is failed', ExecutionState.FAILED],
  ])('executionCompletion()', (name: string, status: ExecutionState) => {
    it(name, async () => {
      const awsResponse1 = fakeQueryExecutionStatus(ExecutionState.QUEUED)
      const awsResponse2 = fakeQueryExecutionStatus(ExecutionState.RUNNING)
      const awsResponse3 = fakeQueryExecutionStatus(status)
      athena.send
        .mockResolvedValueOnce(awsResponse1)
        .mockResolvedValueOnce(awsResponse2)
        .mockResolvedValueOnce(awsResponse3)
      const response = await athenaClient.executionCompletion(fakeQueryId, 10)
      expect(response).toEqual(status)
    })
  })

  describe('executionResults()', () => {
    it('yields result rows', async () => {
      const awsResponse: GetQueryResultsOutput = {
        ResultSet: {
          ResultSetMetadata: {
            ColumnInfo: [
              { Name: 'prison_id', Type: 'STRING' },
              { Name: 'population', Type: 'INT' },
            ],
          },
          Rows: [
            { Data: [{ VarCharValue: 'PR1' }, { VarCharValue: '327' }] },
            { Data: [{ VarCharValue: 'PR2' }, { VarCharValue: '312' }] },
            { Data: [{ VarCharValue: 'PR3' }, { VarCharValue: '198' }] },
          ],
        },
      }
      athena.send.mockResolvedValue(awsResponse)
      const responsePromise = athenaClient.executionResults(fakeQueryId)
      const rows = []
      // eslint-disable-next-line no-restricted-syntax
      for await (const row of responsePromise) {
        rows.push(row)
      }
      expect(rows).toEqual([
        ['PR1', '327'],
        ['PR2', '312'],
        ['PR3', '198'],
      ])
    })
  })

  describe('createCSVTable()', () => {
    it('creates a CSV table', async () => {
      const awsResponse1 = fakeStartQueryExecution()
      const awsResponse2 = fakeQueryExecutionStatus(ExecutionState.SUCCEEDED)
      athena.send.mockResolvedValueOnce(awsResponse1).mockResolvedValueOnce(awsResponse2)
      const bucketLocation = `s3://${bucketConfig.bucket}/population-data-folder/`
      const response = await athenaClient.createCSVTable('prison_population', bucketLocation, [
        'prison_id STRING',
        'population INT',
      ])
      expect(response).toBeTruthy()
      // expect the first parameter of the first call to have SQL
      const [command] = athena.send.mock.calls[0]
      const { QueryString, WorkGroup, QueryExecutionContext } = command.input
      const { Database } = QueryExecutionContext
      expect(WorkGroup).toEqual(athenaConfig.workGroup)
      expect(Database).toEqual(athenaConfig.database)
      expect(QueryString).toEqual(expect.stringContaining('CREATE EXTERNAL TABLE IF NOT EXISTS prison_population'))
      expect(QueryString).toEqual(expect.stringContaining("FIELDS TERMINATED BY ','"))
      expect(QueryString).toEqual(expect.stringContaining("LINES TERMINATED BY '\\n'"))
      expect(QueryString).toEqual(expect.stringContaining(`LOCATION '${bucketLocation}'`))
      expect(QueryString).toEqual(expect.stringContaining('skip.header.line.count'))
      expect(QueryString).toEqual(expect.stringMatching(/;$/))
    })

    describe.each([
      ['with missing prefix', `${bucketConfig.bucket}/population-data-folder/`],
      ['with missing trailing slash', `s3://${bucketConfig.bucket}/population-data-folder/sample.csv`],
      ['with glob pattern', `s3://${bucketConfig.bucket}/population-data-folder/*/`],
      ['with underscore', `s3://${bucketConfig.bucket}/population_data_folder/`],
      ['with ARN included', `s3://arn:aws:s3:::${bucketConfig.bucket}/population-data-folder/`],
    ])('disallows invalid S3 location', (name: string, bucketLocation: string) => {
      it(name, () => {
        expect(
          athenaClient.createCSVTable('prison_population', bucketLocation, ['prison_id STRING', 'population INT'])
        ).rejects.toThrow(/s3Location must/)
      })
    })
  })

  describe('dropTable()', () => {
    it('deletes a table', async () => {
      const awsResponse1 = fakeStartQueryExecution()
      const awsResponse2 = fakeQueryExecutionStatus(ExecutionState.SUCCEEDED)
      athena.send.mockResolvedValueOnce(awsResponse1).mockResolvedValueOnce(awsResponse2)
      const response = await athenaClient.dropTable('prison_population')
      expect(response).toBeTruthy()
      // expect the first parameter of the first call to have SQL
      const [command] = athena.send.mock.calls[0]
      const { QueryString, WorkGroup, QueryExecutionContext } = command.input
      const { Database } = QueryExecutionContext
      expect(WorkGroup).toEqual(athenaConfig.workGroup)
      expect(Database).toEqual(athenaConfig.database)
      expect(QueryString).toEqual('DROP TABLE IF EXISTS prison_population;')
    })
  })
})
