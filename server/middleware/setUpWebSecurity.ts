import crypto from 'crypto'
import express, { Request, Response, Router } from 'express'
import helmet from 'helmet'

export default function setUpWebSecurity(): Router {
  const router = express.Router()

  // Secure code best practice - see:
  // 1. https://expressjs.com/en/advanced/best-practice-security.html,
  // 2. https://www.npmjs.com/package/helmet

  router.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('hex')
    next()
  })
  router.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: [
            "'self'",
            (req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`,
            // WARNING: Required by vegaEmbeb to render graph on the client side ⚠️
            // https://github.com/vega/vega/issues/1106
            "'unsafe-eval'",
          ],
          styleSrc: [
            "'self'",
            // vega-embed styles (better than using 'unsafe-inline')
            "'sha256-OFmSA1qUYJVEnJD+Lk0NB+cugrPZzqE1VLybxdqSXb0='",
            "'sha256-/gFjybzm2cU4MbaLSWpSqW5eLj+JZBii6jm4umpv1+A='",
          ],
        },
      },
    })
  )

  // Cf. https://security-guidance.service.justice.gov.uk/implement-security-txt/
  router.get('/.well-known/security.txt', async (req, res) =>
    res.redirect(
      'https://raw.githubusercontent.com/ministryofjustice/security-guidance/main/contact/vulnerability-disclosure-security.txt'
    )
  )

  return router
}
