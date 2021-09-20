import type { RequestHandler, Router } from 'express'

import asyncMiddleware from '../middleware/asyncMiddleware'
import getS3Client from '../utils/s3'
import { getViz1 } from '../utils/visualisations'

export default function routes(router: Router): Router {
  const get = (path: string, handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  get('/', async (req, res, next) => {
    const s3Client = getS3Client()

    const viz1 = await getViz1(s3Client)

    // const svgFile = createWriteStream('/tmp/vega-output.svg')
    // svgFile.write(viz1)

    res.locals = {
      vis1: viz1,
      vis2: viz1,
    }
    res.render('pages/index')
  })

  return router
}
