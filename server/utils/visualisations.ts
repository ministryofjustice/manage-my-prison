import { Readable } from 'stream'

import { GetObjectCommand, S3, SelectObjectContentCommandInput } from '@aws-sdk/client-s3'
import * as vega from 'vega'

import { StringDecoder } from 'string_decoder'
import config from '../config'

export async function getViz1(s3Client: S3): Promise<string> {
  // Example Vega bar chart visualisation:
  // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
  const data = await getData(s3Client, 'sandbox/bar-chart.vg.json')
  const spec = JSON.parse(data)

  const view = new vega.View(vega.parse(spec))
  return view.toSVG()
}

export async function getViz2(s3Client: S3): Promise<string> {
  // Example Vega bar chart visualisation:
  // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
  const specData = await getData(s3Client, 'sandbox/bar-chart.vg.json')
  const spec = JSON.parse(specData)

  // TODO: Updated fill colour to distinguish 2nd visualisation
  spec.marks[0].encode.update.fill.value = 'purple'

  // DEBUG
  const allData = await getData(s3Client, 'sandbox/viz2-data.csv')
  console.dir('all data in CSV')
  console.dir(allData)

  const s3selectParams: SelectObjectContentCommandInput = {
    Bucket: config.s3.bucket_name,
    Key: 'sandbox/viz2-data.csv',
    ExpressionType: 'SQL',
    Expression: `SELECT category, amount FROM s3object`,
    // Expression: `SELECT category, amount FROM s3object WHERE category IN ('A', 'B', 'I', 'L')`,
    // Expression: `SELECT category, amount FROM s3object WHERE category IN ('Z')`,
    // Expression: `SELECT category, amount FROM s3object WHERE CAST(amount AS NUMERIC) < 50`,
    // Expression: `SELECT category, amount FROM s3object WHERE amount < 50`, // This doesn't work, need CAST
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

  const s3SelectResult = await s3Client.selectObjectContent(s3selectParams)

  const readable = Readable.from(s3SelectResult.Payload)
  const data = await getS3selectData(readable)

  console.dir('filtered data')
  console.dir(data)

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
