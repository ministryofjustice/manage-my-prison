// import { createWriteStream } from 'fs'
import { Readable } from 'stream'

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import type { RequestHandler, Router } from 'express'
import * as vega from 'vega'

import config from '../config'
import asyncMiddleware from '../middleware/asyncMiddleware'

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

export default function routes(router: Router): Router {
  const get = (path: string, handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    const s3Client = new S3Client({
      region: config.s3.bucket_region,
      credentials: {
        accessKeyId: config.s3.access_key_id,
        secretAccessKey: config.s3.secret_access_key,
      },
    })

    const getObjectCommand = new GetObjectCommand({
      Bucket: config.s3.bucket_name,
      // Example Vega bar chart visualisation:
      // https://github.com/vega/vega/blob/master/docs/examples/bar-chart.vg.json
      Key: `sandbox/bar-chart.vg.json`,
    })

    const data = await s3Client.send(getObjectCommand)
    const content = await readStream(data.Body as Readable)
    const vizSpec = JSON.parse(content)

    // const { spec } = vl.compile(vizSpec).spec
    const view = new vega.View(vega.parse(vizSpec))
    const vizSVG = await view.toSVG()

    // const svgFile = createWriteStream('/tmp/vega-output.svg')
    // svgFile.write(vizSVG)

    res.locals = {
      visSpec: vizSpec,
      visSVG: vizSVG,
    }
    res.render('pages/index')
  })

  return router
}
