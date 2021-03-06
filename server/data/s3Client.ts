import { Readable } from 'stream'

import {
  S3Client as Client,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectCommandInput,
  DeleteObjectCommand,
  SelectObjectContentCommand,
  SelectObjectContentCommandInput,
} from '@aws-sdk/client-s3'

export interface S3BucketConfig {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint?: string
}

export default class S3Client {
  s3: Client

  bucket: string

  constructor(config: S3BucketConfig) {
    this.s3 = new Client({
      region: 'eu-west-2',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: true,
    })
    this.bucket = config.bucket
  }

  async getObject(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    const response = await this.s3.send(command)
    const readableBody = response.Body as Readable
    const chunks: Uint8Array[] = []
    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of readableBody) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  async putObject(
    key: string,
    data: string | Readable | Buffer | Uint8Array,
    options: Omit<PutObjectCommandInput, 'Bucket' | 'Key' | 'Body'> = {}
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ...options,
    })
    await this.s3.send(command)
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    await this.s3.send(command)
  }

  async listObjects(prefix?: string): Promise<string[]> {
    let nextToken: string | undefined
    const objects: string[] = []
    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: nextToken,
      })
      // eslint-disable-next-line no-await-in-loop
      const response = await this.s3.send(command)
      const contents = response.Contents || []
      const results = contents.map(object => object.Key)
      nextToken = response.NextContinuationToken
      objects.push(...results)
    } while (nextToken)
    return objects
  }

  async selectObjectContent(s3selectParams: SelectObjectContentCommandInput): Promise<unknown[]> {
    const command = new SelectObjectContentCommand(s3selectParams)
    const response = await this.s3.send(command)
    const records: Uint8Array[] = []
    // eslint-disable-next-line no-restricted-syntax
    for await (const event of response.Payload) {
      if (event.Records?.Payload) {
        records.push(event.Records.Payload)
      }
    }
    // 1 Convert records to a buffer and then to a string
    // 2. Remove any trailing commas as S3 select returns json like `{}, {}, {},`
    const jsonObjects = Buffer.concat(records).toString('utf8').replace(/,$/, '')
    return JSON.parse(`[${jsonObjects}]`)
  }
}
