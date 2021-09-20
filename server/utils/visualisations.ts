import { Readable } from 'stream'

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import * as vega from 'vega'

import config from '../config'

export async function getViz1(s3Client: S3Client): Promise<string> {
  // Example Vega bar chart visualisation:
  // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
  const data = await getData(s3Client, 'sandbox/bar-chart.vg.json')
  const spec = JSON.parse(data)

  const view = new vega.View(vega.parse(spec))
  return view.toSVG()
}

export function getViz2(): vega.Spec {
  return {}
}

async function getData(s3Client: S3Client, s3key: string): Promise<string> {
  const getObjectCommand = new GetObjectCommand({
    Bucket: config.s3.bucket_name,
    Key: s3key,
  })

  const getObjectResult = await s3Client.send(getObjectCommand)
  return readStream(getObjectResult.Body as Readable)
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
