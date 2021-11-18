import path from 'path'
import compression from 'compression'
import express, { Router } from 'express'
import noCache from 'nocache'

import config from '../config'

export default function setUpStaticResources(): Router {
  const router = express.Router()

  router.use(compression())

  //  Static Resources Configuration
  const cacheControl = { maxAge: config.staticResourceCacheDuration * 1000 }
  ;['/assets/images', '/assets/js', '/assets/stylesheets'].forEach(dir => {
    router.use(dir, express.static(path.join(process.cwd(), dir), cacheControl))
  })
  ;[
    '/node_modules/govuk-frontend/govuk/assets',
    '/node_modules/@ministryofjustice/frontend/moj/assets',
  ].forEach(dir => {
    router.use('/assets', express.static(path.join(process.cwd(), dir), cacheControl))
  })
  ;[
    ['/assets/images/favicon.ico', '/favicon.ico'],
    ['/node_modules/vega/build/vega.min.js', '/assets/js/vega.min.js'],
    ['/node_modules/vega-lite/build/vega-lite.min.js', '/assets/js/vega-lite.min.js'],
    ['/node_modules/vega-embed/build/vega-embed.min.js', '/assets/js/vega-embed.min.js'],
    // Serve data used by interactive visualisation example
    ['/data/seattle-weather.csv', '/data/seattle-weather.csv'],
  ].forEach(mapping => {
    const [filePath, urlPath] = mapping
    router.use(urlPath, express.static(path.join(process.cwd(), filePath), cacheControl))
  })

  // Don't cache dynamic resources
  router.use(noCache())

  return router
}
