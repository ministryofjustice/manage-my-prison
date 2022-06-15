import express from 'express'

import path from 'path'
import createError from 'http-errors'

import allRoutes from './routes.js'
import nunjucksSetup from './utils/nunjucksSetup.js'
import errorHandler from './errorHandler.js'
import standardRouter from './routes/standardRouter.js'
import type UserService from './services/userService.js'

import { setUpSentryRequestHandler, setUpSentryErrorHandler } from './middleware/setUpSentry.js'
import setUpWebSession from './middleware/setUpWebSession.js'
import setUpStaticResources from './middleware/setUpStaticResources.js'
import setUpWebSecurity from './middleware/setUpWebSecurity.js'
import setUpAuthentication from './middleware/setUpAuthentication.js'
import setUpHealthChecks from './middleware/setUpHealthChecks.js'
import setUpWebRequestParsing from './middleware/setupRequestParsing.js'
import authorisationMiddleware from './middleware/authorisationMiddleware.js'

export default function createApp(userService: UserService): express.Application {
  const app = express()

  app.set('json spaces', 2)
  app.set('trust proxy', true)
  app.set('port', process.env.PORT || 3000)

  setUpSentryRequestHandler(app)
  app.use(setUpHealthChecks())
  app.use(setUpWebSecurity())
  app.use(setUpWebSession())
  app.use(setUpWebRequestParsing())
  app.use(setUpStaticResources())
  nunjucksSetup(app, path)
  app.use(setUpAuthentication())
  app.use(authorisationMiddleware())

  app.use('/', allRoutes(standardRouter(userService)))

  app.use((req, res, next) => next(createError(404, 'Not found')))
  setUpSentryErrorHandler(app)
  app.use(errorHandler(process.env.NODE_ENV === 'production'))

  return app
}
