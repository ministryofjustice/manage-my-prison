import TokenStore, { RedisClient } from './tokenStore.js'

const redisClient = {
  isOpen: true,
  connect: jest.fn(),
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
}

describe('tokenStore', () => {
  let tokenStore: TokenStore

  beforeEach(() => {
    redisClient.isOpen = true
    tokenStore = new TokenStore(redisClient as unknown as RedisClient)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Can retrieve token', async () => {
    redisClient.get.mockResolvedValueOnce('token-1')

    await expect(tokenStore.getToken('user-1')).resolves.toBe('token-1')

    expect(redisClient.get).toHaveBeenCalledWith('systemToken:user-1')
  })

  it('Can set token', async () => {
    redisClient.set.mockResolvedValueOnce('OK')

    await tokenStore.setToken('user-1', 'token-1', 10)

    expect(redisClient.set).toHaveBeenCalledWith('systemToken:user-1', 'token-1', { EX: 10 })
  })

  it('Connects to redis on first get call', async () => {
    redisClient.isOpen = false
    redisClient.get.mockResolvedValueOnce('token-1')
    await tokenStore.getToken('user-1')
    expect(redisClient.connect).toHaveBeenCalled()
  })

  it('Connects to redis on first set call', async () => {
    redisClient.isOpen = false
    redisClient.set.mockResolvedValueOnce('OK')
    await tokenStore.setToken('user-1', 'token-1', 10)
    expect(redisClient.connect).toHaveBeenCalled()
  })
})
