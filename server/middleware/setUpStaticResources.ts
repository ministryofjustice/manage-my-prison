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
    '/node_modules/govuk-frontend',
    '/node_modules/@ministryofjustice/frontend/moj/assets',
    '/node_modules/@ministryofjustice/frontend',
  ].forEach(dir => {
    router.use('/assets', express.static(path.join(process.cwd(), dir), cacheControl))
  })
  ;[
    ['/assets/images/favicon.ico', '/favicon.ico'],
    ['/node_modules/jquery/dist/jquery.min.js', '/assets/js/jquery.min.js'],
  ].forEach(mapping => {
    const [filePath, urlPath] = mapping
    router.use(urlPath, express.static(path.join(process.cwd(), filePath), cacheControl))
  })

  // Don't cache dynamic resources
  router.use(noCache())

  return router
}
