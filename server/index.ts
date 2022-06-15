import createApp from './app.js'
import HmppsAuthClient from './data/hmppsAuthClient.js'
import TokenStore from './data/tokenStore.js'
import UserService from './services/userService.js'

const hmppsAuthClient = new HmppsAuthClient(new TokenStore())
const userService = new UserService(hmppsAuthClient)

const app = createApp(userService)

export default app
