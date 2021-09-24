import { S3 } from '@aws-sdk/client-s3'

import config from '../config'

export default function getClient(): S3 {
  return new S3({
    region: config.s3.bucket_region,
    credentials: {
      accessKeyId: config.s3.access_key_id,
      secretAccessKey: config.s3.secret_access_key,
    },
    endpoint: config.s3.endpoint,
    forcePathStyle: true,
  })
}
