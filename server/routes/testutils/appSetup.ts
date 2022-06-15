import express, { Router, Express } from 'express'
import cookieSession from 'cookie-session'
import createError from 'http-errors'
import path from 'path'

import allRoutes from '../index.js'
import nunjucksSetup from '../../utils/nunjucksSetup.js'
import errorHandler from '../../errorHandler.js'
import standardRouter from '../standardRouter.js'
import UserService from '../../services/userService.js'
import * as auth from '../../authentication/auth.js'
import setUpWebRequestParsing from '../../middleware/setupRequestParsing.js'
import setUpWebSecurity from '../../middleware/setUpWebSecurity.js'

const user = {
  name: 'john smith',
  firstName: 'john',
  lastName: 'smith',
  username: 'user1',
  displayName: 'John Smith',
}

class MockUserService extends UserService {
  constructor() {
    super(undefined)
  }

  async getUser(token: string) {
    return {
      token,
      ...user,
    }
  }
}

function appSetup(route: Router, production: boolean): Express {
  const app = express()

  app.set('view engine', 'njk')

  nunjucksSetup(app, path)

  app.use((req, res, next) => {
    res.locals = {}
    res.locals.user = req.user
    next()
  })

  app.use(setUpWebSecurity())
  app.use(cookieSession({ keys: [''] }))
  app.use(setUpWebRequestParsing())
  app.use('/', route)
  app.use((req, res, next) => next(createError(404, 'Not found')))
  app.use(errorHandler(production))

  return app
}

export default function appWithAllRoutes({ production = false }: { production?: boolean }): Express {
  auth.default.authenticationMiddleware = () => (req, res, next) => next()
  return appSetup(allRoutes(standardRouter(new MockUserService())), production)
}
