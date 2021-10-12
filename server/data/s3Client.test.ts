import type { GetObjectOutput, SelectObjectContentOutput } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

import config from '../config'
import S3Client, { S3BucketConfig } from './s3Client'

const bucketConfig = { bucket: 'bucket1' }

const s3 = {
  send: jest.fn().mockReturnThis(),
}

jest.mock('@aws-sdk/client-s3', () => {
  const { GetObjectCommand, SelectObjectContentCommand } = jest.requireActual('@aws-sdk/client-s3')
  return {
    S3Client: jest.fn(() => s3),
    GetObjectCommand,
    SelectObjectContentCommand,
  }
})

describe('s3Client', () => {
  let s3Client: S3Client

  beforeEach(() => {
    s3Client = new S3Client(bucketConfig as S3BucketConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return object', async () => {
    const object = Buffer.from('some object')
    const stream = Readable.from(object)
    const awsResponse: GetObjectOutput = { Body: stream }
    s3.send.mockResolvedValue(awsResponse)
    const response = await s3Client.getObject('any-key')
    expect(response).toEqual('some object')
  })

  it('should return array of objects', async () => {
    const object = [{ amount: 123 }, { amount: 234 }]

    async function* it() {
      yield { Records: { Payload: Buffer.from(`${JSON.stringify(object[0])},`) } }
      yield { Records: { Payload: Buffer.from(`${JSON.stringify(object[1])},`) } }
    }

    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield* await it()
      },
    }
    const awsResponse: SelectObjectContentOutput = { Payload: asyncIterable }
    s3.send.mockResolvedValue(awsResponse)

    const command = {
      Bucket: config.s3.bucket,
      Key: 'test-data.csv',
      ExpressionType: 'SQL',
      Expression: `SELECT amount FROM s3object`,
      InputSerialization: {
        CSV: {
          FileHeaderInfo: 'USE',
          RecordDelimiter: '\n',
          FieldDelimiter: ',',
        },
      },
      OutputSerialization: {
        JSON: {
          RecordDelimiter: ',',
        },
      },
    }

    const response = await s3Client.selectObjectContent(command)
    expect(response).toEqual(expect.arrayContaining(object))
  })
})
