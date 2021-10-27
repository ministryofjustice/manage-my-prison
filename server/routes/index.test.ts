import { readFile } from 'fs/promises'

import { QueryExecutionState } from '@aws-sdk/client-athena'
import type { Express } from 'express'
import request from 'supertest'

import appWithAllRoutes from './testutils/appSetup'
import AthenaClient from '../data/athenaClient'
import S3Client from '../data/s3Client'

jest.mock('../../logger')
jest.mock('../data/athenaClient')
jest.mock('../data/s3Client')

const mockedAthenaClientClass = AthenaClient as jest.Mocked<typeof AthenaClient>
const mockedAthenaClient = AthenaClient.prototype as jest.Mocked<AthenaClient>
const mockedS3Client = S3Client.prototype as jest.Mocked<S3Client>

let app: Express

beforeEach(() => {
  mockedAthenaClientClass.isConfigSufficient.mockReturnValue(true)
  app = appWithAllRoutes({})
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /', () => {
  it('renders sample charts', () => {
    mockedS3Client.getObject.mockReturnValue(readFile('data/bar-chart.vg.json', { encoding: 'utf8' }))
    mockedS3Client.selectObjectContent.mockResolvedValue([
      { category: 'X', amount: 10 },
      { category: 'Y', amount: 20 },
      { category: 'Z', amount: 30 },
    ])

    return request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(res => {
        const responseContent = res.text
        expect(responseContent).toContain('Manage My Prison – Behaviour entries')
        expect(responseContent).toContain('with 8 values: A, B, C, D, E, ending with H') // from mocked S3 object for viz 1
        expect(responseContent).toContain('with 3 values: X, Y, Z') // from mocked S3 select for viz 2
        expect(responseContent).toContain('with 9 values: A, B, C, D, E, ending with I') // from unmocked viz 3
      })
  })
})

describe('GET /athena-sample', () => {
  it('renders sample Athena chart', () => {
    mockedAthenaClient.startExecution.mockResolvedValueOnce('11111111-2222-3333-4444-555555555555')
    mockedAthenaClient.executionCompletion.mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
    mockedAthenaClient.executionResults = async function* results() {
      yield ['date', 'min', 'avg', 'max']
      yield ['2021-07-01', '0.0', '1.0', '23.2']
      yield ['2021-08-01', '1.0', '5.2', '32.0']
      yield ['2021-09-01', '0.0', '4.5', '23.2']
    } as never

    return request(app)
      .get('/athena-sample')
      .expect(res => {
        const responseContent = res.text
        expect(responseContent).toContain('Manage My Prison – Athena Sample')
        expect(responseContent).toContain('Date: Jul 2021; Precipitation: 1')
        expect(responseContent).toContain('Date: Aug 2021; Precipitation: 5.2')
        expect(responseContent).toContain('Date: Sep 2021; Precipitation: 4.5')
      })
  })

  it('presents an error if query fails', () => {
    mockedAthenaClient.startExecution.mockResolvedValueOnce('11111111-2222-3333-4444-555555555555')
    mockedAthenaClient.executionCompletion.mockResolvedValueOnce(QueryExecutionState.FAILED)

    return request(app)
      .get('/athena-sample')
      .expect(res => {
        const responseContent = res.text
        expect(responseContent).toContain('Manage My Prison – Error')
        expect(responseContent).toContain('Athena could not execute query: FAILED')
      })
  })
})
