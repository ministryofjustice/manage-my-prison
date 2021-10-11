import { Readable } from 'stream'

import {
  S3Client as Client,
  GetObjectCommand,
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

  async selectObjectContent(s3selectParams: SelectObjectContentCommandInput): Promise<unknown[]> {
    const command = new SelectObjectContentCommand(s3selectParams)
    const response = await this.s3.send(command)
    const records: Uint8Array[] = []
    // eslint-disable-next-line no-restricted-syntax
    for await (const event of response.Payload) {
      if (event.Records) {
        records.push(event.Records.Payload)
      }
    }
    // 1 Convert records to a buffer and then to a string
    // 2. Remove any trailing commas as S3 select returns json like `{}, {}, {},`
    const jsonObjects = Buffer.concat(records).toString('utf8').replace(/,$/, '')
    return JSON.parse(`[${jsonObjects}]`)
  }
}
