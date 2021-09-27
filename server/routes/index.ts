import type { RequestHandler, Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware'
import VisualisationService from '../services/visualisationService'
import S3Client from '../data/s3Client'
import config from '../config'

export default function routes(router: Router): Router {
  const get = (path: string, handler: RequestHandler) => router.get(path, asyncMiddleware(handler))
  const visualisationService = new VisualisationService(new S3Client(config.s3))

  get('/', async (req, res, next) => {
    const visPopulation = await visualisationService.getVizPopulation()
    const viz1 = await visualisationService.getViz1()
    const viz2 = await visualisationService.getViz2()
    const viz3 = await visualisationService.getViz3()

    res.render('pages/index', { visPopulation, vis1: viz1, vis2: viz2, vis3: viz3 })
  })

  return router
}
