import type {
  GetObjectOutput,
  PutObjectOutput,
  DeleteObjectOutput,
  ListObjectsV2Output,
  SelectObjectContentOutput,
} from '@aws-sdk/client-s3'
import { Readable } from 'stream'

import S3Client, { S3BucketConfig } from './s3Client'

const bucketConfig = { bucket: 'bucket1' } as S3BucketConfig

const s3 = {
  send: jest.fn().mockReturnThis(),
}

jest.mock('@aws-sdk/client-s3', () => {
  const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, SelectObjectContentCommand } =
    jest.requireActual('@aws-sdk/client-s3')
  return {
    S3Client: jest.fn(() => s3),
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    SelectObjectContentCommand,
  }
})

describe('S3Client', () => {
  let s3Client: S3Client

  beforeEach(() => {
    s3Client = new S3Client(bucketConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getObject()', () => {
    it('returns an object as a string', async () => {
      const object = Buffer.from('some object')
      const stream = Readable.from(object)
      const awsResponse: GetObjectOutput = { Body: stream }
      s3.send.mockResolvedValue(awsResponse)
      const response = await s3Client.getObject('any-key')
      expect(response).toEqual('some object')
    })
  })

  describe('putObject()', () => {
    it('uploads a string object', async () => {
      const awsResponse: PutObjectOutput = {}
      s3.send.mockResolvedValue(awsResponse)
      const response = await s3Client.putObject('some-key', 'data to be saved in S3')
      expect(response).toBeUndefined()
      // expect the first parameter of the first call to include bucket name
      const [putCommand] = s3.send.mock.calls[0]
      const { Bucket, Key, Body } = putCommand.input
      expect({ Bucket, Key, Body }).toEqual({
        Bucket: bucketConfig.bucket,
        Key: 'some-key',
        Body: 'data to be saved in S3',
      })
    })
  })

  describe('deleteObject()', () => {
    it('deletes an object', async () => {
      const awsResponse: DeleteObjectOutput = {}
      s3.send.mockResolvedValue(awsResponse)
      const response = await s3Client.deleteObject('a-key')
      expect(response).toBeUndefined()
      // expect the first parameter of the first call to include bucket name
      const [deleteCommand] = s3.send.mock.calls[0]
      const { Bucket, Key } = deleteCommand.input
      expect({ Bucket, Key }).toEqual({
        Bucket: bucketConfig.bucket,
        Key: 'a-key',
      })
    })
  })

  describe('listObjects()', () => {
    it('returns a list of object keys', async () => {
      const awsResponse: ListObjectsV2Output = {
        Contents: [{ Key: 'object 1' }, { Key: 'object-2' }],
      }
      s3.send.mockResolvedValue(awsResponse)
      const response = await s3Client.listObjects()
      expect(response).toEqual(['object 1', 'object-2'])
    })
  })

  describe('selectObjectContent()', () => {
    it('returns an array of objects', async () => {
      const mockObjects = [{ amount: 123 }, { amount: 234 }]
      const mockPayload = {
        async *[Symbol.asyncIterator]() {
          yield { Records: { Payload: Buffer.from(`${JSON.stringify(mockObjects[0])},`) } }
          yield { Records: { Payload: Buffer.from(`${JSON.stringify(mockObjects[1])},`) } }
        },
      }
      const awsResponse: SelectObjectContentOutput = { Payload: mockPayload }
      s3.send.mockResolvedValue(awsResponse)

      const command = {
        Bucket: bucketConfig.bucket,
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
      expect(response).toEqual(expect.arrayContaining(mockObjects))
    })
  })
})
