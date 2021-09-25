import { SelectObjectContentCommandInput, S3, GetObjectCommand, SelectObjectContentCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import getStream from 'get-stream'

export interface S3BucketConfig {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint?: string
}

export default class S3Client {
  s3: S3

  bucket: string

  constructor(config: S3BucketConfig) {
    this.s3 = new S3({
      apiVersion: '2006-03-01',
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
    return (await getStream.buffer(response.Body as Readable)).toString()
  }

  async selectObjectContent(s3selectParams: SelectObjectContentCommandInput): Promise<any[]> {
    const command = new SelectObjectContentCommand(s3selectParams)
    const response = await this.s3.send(command)

    const records: Uint8Array[] = []
    /* eslint-disable-next-line */
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
