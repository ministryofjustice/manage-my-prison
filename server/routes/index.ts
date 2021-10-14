import type { RequestHandler, Router } from 'express'

import config from '../config'
import AthenaClient from '../data/athenaClient'
import S3Client from '../data/s3Client'
import asyncMiddleware from '../middleware/asyncMiddleware'
import VisualisationService from '../services/visualisationService'

export default function routes(router: Router): Router {
  const get = (path: string, handler: RequestHandler) => router.get(path, asyncMiddleware(handler))

  const athenaClient = AthenaClient.isConfigSufficient(config.athena) ? new AthenaClient(config.athena) : undefined
  const s3Client = new S3Client(config.s3)
  const visualisationService = new VisualisationService(s3Client, athenaClient)

  get('/', async (req, res, next) => {
    const visPopulation = await visualisationService.getVizPopulation()
    const viz1 = await visualisationService.getViz1()
    const viz2 = await visualisationService.getViz2()
    const viz3 = await visualisationService.getViz3()

    res.render('pages/index', { visPopulation, vis1: viz1, vis2: viz2, vis3: viz3 })
  })

  return router
}
