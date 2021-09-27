import { Readable } from 'stream'
import S3Client, { S3BucketConfig } from './s3Client'
import config from '../config'

const bucketConfig = { bucket: 'bucket1' }

const s3 = {
  send: jest.fn().mockReturnThis(),
}

const getObjectCommand = {
  GetObjectCommand: jest.fn().mockReturnThis(),
}

const selectObjectContentCommand = {
  GetObjectCommand: jest.fn().mockReturnThis(),
}

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3: jest.fn(() => s3),
    GetObjectCommand: jest.fn(() => getObjectCommand),
    SelectObjectContentCommand: jest.fn(() => selectObjectContentCommand),
  }
})

describe('s3Client', () => {
  let s3Client: S3Client

  beforeEach(() => {
    s3Client = new S3Client(<S3BucketConfig>bucketConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return object', async () => {
    const object = Buffer.from('some object')
    const stream = Readable.from(object.toString())
    s3.send.mockResolvedValue({ Body: stream })
    const response = await s3Client.getObject('any-key')
    expect(response).toEqual(object.toString())
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
    s3.send.mockResolvedValue({ Payload: asyncIterable })

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
