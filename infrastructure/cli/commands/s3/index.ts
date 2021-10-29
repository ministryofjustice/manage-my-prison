import {Readable} from 'stream'

import {S3Client} from '@aws-sdk/client-s3'
import {DeleteObjectCommand, GetObjectCommand, PutObjectCommand} from '@aws-sdk/client-s3'
import {paginateListObjectsV2, _Object as S3Object} from '@aws-sdk/client-s3'

import {Environment, REGION, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'

export const description = 'Manage objects stored in S3 buckets'

export class Client {
  static secretName = 's3'

  static async load(environment: Environment): Promise<Client> {
    const ns = namespace(environment)
    const kubernetes = new KubernetesApi()
    const secret = await kubernetes.getDecodedSecret(ns, Client.secretName)
    if (!secret) {
      throw new Error(`Cannot find S3 secret in ${ns}`)
    }
    const {bucket_name: bucketName, access_key_id: accessKeyId, secret_access_key: secretAccessKey} = secret
    const s3Client = new S3Client({
      region: REGION,
      credentials: {accessKeyId, secretAccessKey},
    })
    return new Client(environment, bucketName, s3Client)
  }

  private constructor(
    readonly environment: Environment,
    readonly bucketName: string,
    private readonly s3Client: S3Client,
  ) {}

  async listObjects(prefix: string | undefined = undefined): Promise<S3Object[]> {
    const paginator = paginateListObjectsV2({client: this.s3Client}, {
      Bucket: this.bucketName,
      Prefix: prefix,
    })
    const list = []
    for await (const response of paginator) {
      const rows = response.Contents || []
      list.push(...rows)
    }
    return list
  }

  async getObject(key: string): Promise<{
    lastModified: Date,
    contentType: string | null,
    encoding: string | null,
    metadata: {[key: string]: string},
    content: Readable,
  }> {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const lastModified = response.LastModified!
    const contentType = response.ContentType || null
    const encoding = response.ContentEncoding || null
    const metadata = response.Metadata || {}
    const content = response.Body as Readable
    return {lastModified, contentType, encoding, metadata, content}
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }))
  }

  async putObject(key: string, content: Buffer): Promise<void> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: content,
    }))
  }
}
