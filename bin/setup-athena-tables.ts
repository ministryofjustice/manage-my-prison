import * as fs from 'fs'
import * as path from 'path'

import 'dotenv/config'

import AthenaClient from '../server/data/athenaClient'
import S3Client from '../server/data/s3Client'

const table = 'sample'
const sampleCsvPath = path.resolve(process.cwd(), 'data', 'seattle-weather.csv')
const databaseS3Path = 'athena/sample/' // NB: must end in slash
const sampleCsvS3Path = `${databaseS3Path}data.csv`

function getEnvironmentVariable(name: string) {
  if (process.env[name]) {
    return process.env[name]
  }
  throw new Error(`Missing env var ${name}`)
}

async function main() {
  const s3Client = new S3Client({
    accessKeyId: getEnvironmentVariable('S3_ACCESS_KEY_ID'),
    secretAccessKey: getEnvironmentVariable('S3_SECRET_ACCESS_KEY'),
    bucket: getEnvironmentVariable('S3_BUCKET_NAME'),
  })
  process.stderr.write(`Uploading “${path.basename(sampleCsvPath)}” to “${sampleCsvS3Path}” is S3 bucket…\n`)
  await s3Client.putObject(sampleCsvS3Path, fs.createReadStream(sampleCsvPath))

  const athenaClient = new AthenaClient({
    accessKeyId: getEnvironmentVariable('ATHENA_ACCESS_KEY_ID'),
    secretAccessKey: getEnvironmentVariable('ATHENA_SECRET_ACCESS_KEY'),
    workGroup: getEnvironmentVariable('ATHENA_WORK_GROUP'),
    database: getEnvironmentVariable('ATHENA_DATABASE'),
  })
  process.stderr.write(`Creating “${table}” in Athena if it does not already exist…\n`)
  return athenaClient.createCSVTable(table, `s3://${s3Client.bucket}/${databaseS3Path}`, [
    'date DATE',
    'precipitation DECIMAL(3,1)',
    'temp_max DECIMAL(3,1)',
    'temp_min DECIMAL(3,1)',
    'wind DECIMAL(3,1)',
    'weather VARCHAR(10)',
  ])
}

;(async () => main())()
