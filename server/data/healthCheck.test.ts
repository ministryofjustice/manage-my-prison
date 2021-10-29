import nock from 'nock'

import { serviceCheckFactory } from './healthCheck'
import { AgentConfig } from '../config'
import { overrideLoggerAsync } from '../../logger'

describe('Service healthcheck', () => {
  const healthcheck = serviceCheckFactory('externalService', 'http://test-service.com/ping', new AgentConfig(), {
    response: 100,
    deadline: 150,
  })

  let fakeServiceApi: nock.Scope

  beforeAll(() => {
    jest.resetModules()
  })

  beforeEach(() => {
    fakeServiceApi = nock('http://test-service.com')
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(() => {
    // nocks' cleanAll() doesn't clear delays' requests, these hang causing the warning:
    // 'This usually means that there are asynchronous operations that weren't stopped in your tests.'
    // See: https://github.com/nock/nock/issues/1118
    nock.abortPendingRequests()
  })

  describe('Check healthy', () => {
    it('Should return data from api', async () => {
      fakeServiceApi.get('/ping').reply(200, 'pong')

      const output = await healthcheck()
      expect(output).toEqual('OK')
    })
  })

  describe('Check unhealthy', () => {
    it('Should throw error from api', async () => {
      fakeServiceApi.get('/ping').thrice().reply(500)

      await expect(overrideLoggerAsync(healthcheck)).rejects.toThrow('Internal Server Error')
    })
  })

  describe('Check healthy retry test', () => {
    it('Should retry twice if request fails', async () => {
      fakeServiceApi
        .get('/ping')
        .reply(500, { failure: 'one' })
        .get('/ping')
        .reply(500, { failure: 'two' })
        .get('/ping')
        .reply(200, 'pong')

      const response = await healthcheck()
      expect(response).toEqual('OK')
    })

    it('Should retry twice if request times out', async () => {
      fakeServiceApi
        .get('/ping')
        .delay(10000) // delay set to 10s, timeout to 900/3=300ms
        .reply(200, { failure: 'one' })
        .get('/ping')
        .delay(10000)
        .reply(200, { failure: 'two' })
        .get('/ping')
        .reply(200, 'pong')

      const response = await healthcheck()
      expect(response).toEqual('OK')
    })

    it('Should fail if request times out three times', async () => {
      fakeServiceApi
        .get('/ping')
        .delay(10000) // delay set to 10s, timeout to 900/3=300ms
        .reply(200, { failure: 'one' })
        .get('/ping')
        .delay(10000)
        .reply(200, { failure: 'two' })
        .get('/ping')
        .delay(10000)
        .reply(200, { failure: 'three' })

      await expect(healthcheck()).rejects.toThrow('Response timeout of 100ms exceeded')
    })
  })
})
