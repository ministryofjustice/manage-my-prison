import connectRedis from 'connect-redis'
import express, { Router } from 'express'
import addRequestId from 'express-request-id'
import session from 'express-session'
import { createClient } from 'redis'

import config from '../config'

const RedisStore = connectRedis(session)

const redisURL =
  config.redis.tls_enabled === 'true'
    ? `rediss://${config.redis.host}:${config.redis.port}`
    : `redis://${config.redis.host}:${config.redis.port}`

const client = createClient({
  url: redisURL,
  password: config.redis.password,
  legacyMode: true,
})
client.connect()

export default function setUpWebSession(): Router {
  const router = express.Router()
  router.use(
    session({
      store: new RedisStore({ client }),
      cookie: { secure: config.https, sameSite: 'lax', maxAge: config.session.expiryMinutes * 60 * 1000 },
      secret: config.session.secret,
      resave: false, // redis implements touch so shouldn't need this
      saveUninitialized: false,
      rolling: true,
    })
  )

  // Update a value in the cookie so that the set-cookie will be sent.
  // Only changes every minute so that it's not sent with every request.
  router.use((req, res, next) => {
    req.session.nowInMinutes = Math.floor(Date.now() / 60e3)
    next()
  })

  router.use(addRequestId())

  return router
}
