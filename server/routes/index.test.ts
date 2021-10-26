import type { Express } from 'express'
import request from 'supertest'
import appWithAllRoutes from './testutils/appSetup'
import VisualisationService from '../services/visualisationService'

jest.mock('../services/visualisationService')
const mockedVisualisationService = VisualisationService.prototype as jest.Mocked<VisualisationService>

let app: Express

beforeEach(() => {
  app = appWithAllRoutes({})
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /', () => {
  it('renders index page', () => {
    mockedVisualisationService.getViz1.mockResolvedValue('§viz1')
    mockedVisualisationService.getViz2.mockResolvedValue('§viz2')
    mockedVisualisationService.getViz3.mockResolvedValue('§viz3')
    mockedVisualisationService.getVizPopulation.mockResolvedValue('§vizPopulation')

    return request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(res => {
        const responseContent = res.text
        expect(responseContent).toContain('Manage My Prison – Behaviour entries')
        expect(responseContent).toContain('§viz1')
        expect(responseContent).toContain('§viz2')
        expect(responseContent).toContain('§viz3')
        expect(responseContent).toContain('§vizPopulation')
      })
  })
})
describe('GET /athena-sample', () => {
  it('renders sample Athena chart', () => {
    mockedVisualisationService.getAthenaViz.mockResolvedValue('§athenaViz')

    return request(app)
      .get('/athena-sample')
      .expect(res => {
        const responseContent = res.text
        expect(responseContent).toContain('Manage My Prison – Athena Sample')
        expect(responseContent).toContain('§athenaViz')
      })
  })
})
