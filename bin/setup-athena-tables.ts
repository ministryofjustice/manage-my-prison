#!/usr/bin/env npx ts-node
// NB: this script can be run locally with `./bin/setup-athena-tables.ts`,
//     on the server, it should be run using `npm run setup-athena-tables`.
import * as fs from 'fs'
import * as path from 'path'

import 'dotenv/config'

import logger from '../logger'
import config from '../server/config'
import AthenaClient from '../server/data/athenaClient'
import S3Client from '../server/data/s3Client'

const table = 'sample'
const sampleCsvPath = path.resolve(process.cwd(), 'data', 'seattle-weather.csv')
const databaseS3Path = 'athena/sample/'
const sampleCsvS3Path = `${databaseS3Path}data.csv`

async function main() {
  if (!AthenaClient.isConfigSufficient(config.athena)) {
    logger.error('Athena configuration is missing')
    process.exit(1)
  }

  const s3Client = new S3Client(config.s3)
  logger.info(`Uploading “${path.basename(sampleCsvPath)}” to “${sampleCsvS3Path}” is S3 bucket…\n`)
  await s3Client.putObject(sampleCsvS3Path, fs.createReadStream(sampleCsvPath))

  const athenaClient = new AthenaClient(config.athena)
  logger.info(`Creating “${table}” in Athena if it does not already exist…\n`)
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
