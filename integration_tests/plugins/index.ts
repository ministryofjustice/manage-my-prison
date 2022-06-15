import { resetStubs } from '../mockApis/wiremock.js'

import auth from '../mockApis/auth.js'
import tokenVerification from '../mockApis/tokenVerification.js'

export default (on: (string, Record) => void): void => {
  on('task', {
    reset: resetStubs,

    getSignInUrl: auth.getSignInUrl,
    stubSignIn: auth.stubSignIn,

    stubAuthUser: auth.stubUser,
    stubAuthPing: auth.stubPing,

    stubTokenVerificationPing: tokenVerification.stubPing,
  })
}
