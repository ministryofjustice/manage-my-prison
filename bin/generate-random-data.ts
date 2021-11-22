#! /usr/bin/env npx ts-node
import { writeFileSync } from 'fs'
import { exit } from 'process'

import faker from 'faker'
import moment from 'moment'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import config from '../server/config.js'
import logger from '../logger.js'
import S3Client from '../server/data/s3Client.js'

interface Options {
  rows: number
  upload: boolean
  seed: number
  verbose: boolean
}

const INCENTIVE_LEVELS = ['BAS', 'EN2', 'ENH', 'ENT', 'STD']
const NOMIS_DATE_FORMAT = 'YYYY-MM-DD h:mm:ss'

if (!['local', 'dev', 'test'].includes(config.environment)) {
  logger.error(`Random data generation not allowed in '${config.environment}' environment`)
  exit(1)
}

function randomCellLocation(): string {
  const parts = [
    faker.random.alpha({ count: 3, upcase: true }),
    faker.random.alpha({ count: 1, upcase: true }),
    faker.datatype.number({ max: 9 }),
    String(faker.datatype.number({ max: 999 })).padStart(3, '0'),
  ]

  return parts.join('-')
}

function randomOffenderId(): string {
  const parts = [
    'A',
    String(faker.datatype.number({ max: 9_999 })).padStart(4, '0'),
    faker.random.alpha({ count: 2, upcase: true }),
  ]

  return parts.join('')
}

function randomNomisDate(): string {
  return moment(faker.date.past()).format(NOMIS_DATE_FORMAT)
}

function objectsToCsv(items: unknown[]): string {
  const valueAsString = (value: unknown): string => {
    return value === null ? '' : value.toString()
  }

  const delimiter = ','
  const fields = Object.keys(items[0])
  let csv = items.map((row: string[]) => {
    const values = fields.map(fieldName => valueAsString(row[fieldName]))
    return values.join(delimiter)
  })

  // add header column
  csv = [fields.join(delimiter), ...csv]

  return csv.join('\r\n')
}

const dataSets: { [name: string]: [string, () => string | number][] } = {
  // See example Jupyter Notebook: https://github.com/moj-analytical-services/manage-my-prison/blob/main/CF%20Incentives%20with%20Altair.ipynb
  nomis_offender_iep_levels: [
    ['offender_book_id', () => faker.datatype.number({ min: 19_000 })],
    ['iep_days', () => faker.datatype.number(3_000)],
    ['iep_months', () => faker.datatype.number({ max: 150, precision: 0.01 })],
    ['iep_years', () => faker.datatype.number({ max: 10, precision: 0.01 })],
    ['agy_loc_id', () => faker.random.alpha({ count: 3, upcase: true })],
    ['iep_level', () => faker.helpers.randomize(INCENTIVE_LEVELS)],
    ['iep_level_seq', () => faker.datatype.number(500)],
    ['nomis_extraction_timestamp', () => randomNomisDate()],
    ['nomis_deleted', () => 'False'],
    ['mojap_start_datetime', () => randomNomisDate()],
    ['mojap_end_datetime', () => '2999-01-01 00:00:00.000'],
    ['mojap_latest_record', () => 'True'],
    ['sex_code', () => faker.helpers.randomize(['F', 'M'])],
    ['age', () => faker.datatype.number({ min: 10, max: 123 })],
    ['cell_loc', randomCellLocation],
    ['offender_id_display', randomOffenderId],
    ['offender_id', () => faker.datatype.number({ min: 1_000_000, max: 3_000_000 })],
    // TODO: It seems to be same as offender_id but it shouldn't matter
    ['root_offender_id', () => faker.datatype.number({ min: 1_000_000, max: 3_000_000 })],
    ['days_custody', () => faker.datatype.number({ max: 20_000, precision: 0.000001 })],
    // TODO: I'm assuming days_log should be LESS THAN OR EQUAL days_custody
    ['days_loc', () => faker.datatype.number({ max: 20_000, precision: 0.000001 })],
  ],
}

async function main(options: Options) {
  faker.seed(options.seed)

  // eslint-disable-next-line no-restricted-syntax
  for (const [dataSet, fields] of Object.entries(dataSets)) {
    const randomData = []

    for (let i = 0; i < options.rows; i += 1) {
      const row = {}

      // eslint-disable-next-line no-restricted-syntax
      for (const [fieldName, generator] of fields) {
        row[fieldName] = generator()
      }

      randomData.push(row)
    }

    const csvString = objectsToCsv(randomData)
    if (options.verbose && options.rows <= 30) {
      logger.info(dataSet, csvString)
    }

    const csvPath = `${process.env.PWD}/data/${dataSet}.csv`
    try {
      writeFileSync(csvPath, csvString, { flag: 'w+' })
    } catch (err) {
      logger.error(`Failed to write CSV file: ${err}`)
      exit(1)
    }

    if (options.verbose) {
      logger.info(`data written to ${csvPath}`)
    }

    if (options.upload) {
      const s3Client = new S3Client(config.s3)
      const s3key = `sandbox/data/${dataSet}.csv`

      // eslint-disable-next-line no-await-in-loop
      await s3Client.putObject(s3key, csvString)

      if (options.verbose) {
        logger.info(`data uploaded to s3://${config.s3.bucket}/${s3key}`)
      }
    } else {
      logger.warn('data NOT uploaded to S3 by default, pass --upload to do so')
    }
  }
}

;(async () => {
  const parser = yargs(hideBin(process.argv)).options({
    rows: { alias: 'n', type: 'number', default: 80_000, describe: 'Number of rows to generate' },
    upload: { alias: 'u', type: 'boolean', default: false, describe: 'Whether upload generated file to S3' },
    seed: { alias: 's', type: 'number', default: 42, describe: 'Random seed used to generate data' },
    verbose: { alias: 'v', type: 'boolean', default: true, describe: 'Displays more information' },
  })

  const argv = await parser.argv

  main(argv)
})()
