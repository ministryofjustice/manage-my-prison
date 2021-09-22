import { Readable } from 'stream'

import { GetObjectCommand, S3, SelectObjectContentCommandInput } from '@aws-sdk/client-s3'
import * as vega from 'vega'
import * as vegaLite from 'vega-lite'

import { StringDecoder } from 'string_decoder'
import config from '../config'
import logger from '../../logger'

/**
 * Gets an example visualisation from S3 and returns the rendered SVG.
 *
 * Data is embedded/hardcoded into the visualisation in this example.
 *
 * @param s3Client S3 client to use to get the visualisation.
 * @returns a Promise<string> with the SVG of the rendered visualisation.
 */
export async function getViz1(s3Client: S3): Promise<string> {
  // Example Vega bar chart visualisation:
  // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
  const data = await getData(s3Client, 'sandbox/bar-chart.vg.json')
  const spec: vega.Spec = JSON.parse(data)

  const view = new vega.View(vega.parse(spec))
  return view.toSVG()
}

/**
 * Gets an example visualisation from S3, gets data from S3 using S3 Select and
 * returns the rendered visualisation.
 *
 * Some example of S3 Select queries are also included (commented) in the code.
 * An example of a possible way to filter data in Vega is also included
 * (commented) in the code.
 *
 * @param s3Client S3 client to use to get the visualisation.
 * @returns a Promise<string> with the SVG of the rendered visualisation.
 */
export async function getViz2(s3Client: S3): Promise<string> {
  // Example Vega bar chart visualisation:
  // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
  const specData = await getData(s3Client, 'sandbox/bar-chart.vg.json')
  const spec = JSON.parse(specData)

  // TODO: Updated fill colour to distinguish 2nd visualisation
  spec.marks[0].encode.update.fill.value = 'purple'

  // DEBUG
  const allData = await getData(s3Client, 'sandbox/viz2-data.csv')
  logger.debug('all data in CSV:\n', allData)

  // const s3SelectQuery = `SELECT category, amount FROM s3object`
  // const s3SelectQuery = `SELECT category, amount FROM s3object WHERE category IN ('A', 'B', 'I', 'L')`
  // const s3SelectQuery = `SELECT category, amount FROM s3object WHERE category IN ('Z')`
  const s3SelectQuery = `SELECT category, amount FROM s3object WHERE CAST(amount AS NUMERIC) < 80`
  // const s3SelectQuery = `SELECT category, amount FROM s3object WHERE amount < 50` // This doesn't work, need CAST
  const s3selectParams: SelectObjectContentCommandInput = {
    Bucket: config.s3.bucket_name,
    Key: 'sandbox/viz2-data.csv',
    ExpressionType: 'SQL',
    Expression: s3SelectQuery,
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
  logger.debug('S3 Select query:\n', s3SelectQuery)

  const s3SelectResult = await s3Client.selectObjectContent(s3selectParams)

  const readable = Readable.from(s3SelectResult.Payload)
  const data = await getS3selectData(readable)

  logger.debug('S3 Select filtered data:\n', data)

  spec.data = [
    {
      name: 'table',
      values: data,
      // NOTE: Vega also has ways to transform data, e.g. to filter it
      // SEE: https://vega.github.io/vega/docs/transforms/
      // transform: [
      //   {
      //     type: 'filter',
      //     expr: 'datum.amount > 20',
      //   },
      // ],
    },
  ]

  const view = new vega.View(vega.parse(spec))
  return view.toSVG()
}

/**
 * This example converts a VegaLite spec into Vega spec before rendering it.
 *
 * VegaLite is an higher level syntax for definiting visualisations (compared to than Vega).
 *
 * Spec and data are hardcoded in this example, it's mainly for the purpose of
 * showing how to convert VegaLite specs into Vega specs for rendering.
 *
 * @returns a Promise<string> with the SVG of the rendered visualisation.
 */
export function getViz3(): Promise<string> {
  const vegaLiteSpec: vegaLite.TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'A simple bar chart with embedded data.',
    width: 400,
    height: 200,
    data: {
      values: [
        { a: 'A', b: 28 },
        { a: 'B', b: 55 },
        { a: 'C', b: 43 },
        { a: 'D', b: 91 },
        { a: 'E', b: 81 },
        { a: 'F', b: 53 },
        { a: 'G', b: 19 },
        { a: 'H', b: 87 },
        { a: 'I', b: 52 },
      ],
    },
    mark: 'bar',
    encoding: {
      x: { field: 'a', type: 'ordinal' },
      y: { field: 'b', type: 'quantitative' },
    },
  }

  // `vega-lite`'s `compile()` converts a Vega-Lite specification into a Vega one
  const { spec: vegaSpec } = vegaLite.compile(vegaLiteSpec)

  const view = new vega.View(vega.parse(vegaSpec))
  return view.toSVG()
}

async function getData(s3Client: S3, s3key: string): Promise<string> {
  const getObjectCommand = new GetObjectCommand({
    Bucket: config.s3.bucket_name,
    Key: s3key,
  })

  const getObjectResult = await s3Client.send(getObjectCommand)
  return readStream(getObjectResult.Body as Readable)
}

function getS3selectData<T>(readable: Readable): Promise<Array<T>> {
  let jsonString = '['
  const decoder = new StringDecoder('utf8')

  return new Promise<Array<T>>(resolve => {
    readable.on('data', chunk => {
      if (chunk.Records) {
        // Decode Uint8Array into a UTF-8 string
        jsonString += decoder.write(Buffer.from(chunk.Records.Payload))
      }
    })

    readable.on('end', () => {
      jsonString += decoder.end()

      if (jsonString.length > 1) {
        // Remove trailing comma (not allowed in JSON)
        jsonString = jsonString.slice(0, -1)
        jsonString += ']'
        resolve(JSON.parse(jsonString))
      } else {
        // No data
        resolve([])
      }
    })
  })
}

function readStream(readable: Readable): Promise<string> {
  return new Promise<string>(resolve => {
    let result = ''

    readable.on('data', chunk => {
      result += chunk.toString()
    })

    readable.on('end', () => {
      resolve(result)
    })
  })
}
