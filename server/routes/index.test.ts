import type { Express } from 'express'
import request from 'supertest'
import appWithAllRoutes from './testutils/appSetup'
import VisualisationService from '../services/visualisationService'

jest.mock('../services/visualisationService')

const visulisationService = new VisualisationService(null) as jest.Mocked<VisualisationService>

let app: Express

beforeEach(() => {
  app = appWithAllRoutes({})
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /', () => {
  it('should render index page', () => {
    visulisationService.getViz1.mockResolvedValue(null)
    visulisationService.getViz2.mockResolvedValue(null)
    visulisationService.getViz3.mockResolvedValue(null)
    visulisationService.getVizPopulation.mockResolvedValue(null)

    return request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(res => {
        expect(res.text).toContain('Behaviour entries')
      })
  })
})
