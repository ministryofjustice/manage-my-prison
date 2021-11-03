import nock from 'nock'

import RestClient from './restClient'
import { AgentConfig } from '../config'
import { overrideLoggerAsync } from '../../logger'

describe('restClient', () => {
  const fakeApiUrl = 'http://localhost:8000/test'
  const fakeToken = 'token-12345'
  const fakeResponse = ['a', 'b', 'c']

  let fakeApi: nock.Scope
  let restClient: RestClient

  beforeEach(() => {
    fakeApi = nock(fakeApiUrl)
    restClient = new RestClient(
      'Test client',
      {
        agent: new AgentConfig(),
        timeout: { deadline: 0, response: 0 },
        url: fakeApiUrl,
      },
      fakeToken
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
    nock.cleanAll()
  })

  describe.each([
    ['sends a request with access token', {}],
    ['sends a request with path and access token', { path: '' }],
  ])('get()', (name: string, params: { path?: string }) => {
    it(name, async () => {
      fakeApi
        .get(params.path || '')
        .matchHeader('authorization', `Bearer ${fakeToken}`)
        .reply(200, fakeResponse)

      const response = overrideLoggerAsync(() => restClient.get(params))
      await expect(response).resolves.toEqual(fakeResponse)
    })
  })

  describe.each([
    ['sends a request with access token', {}],
    ['sends a request with path and access token', { path: '' }],
  ])('post()', (name: string, params: { path?: string }) => {
    it(name, async () => {
      fakeApi
        .post(params.path || '')
        .matchHeader('authorization', `Bearer ${fakeToken}`)
        .reply(200, fakeResponse)

      const response = overrideLoggerAsync(() => restClient.post(params))
      await expect(response).resolves.toEqual(fakeResponse)
    })
  })
})
