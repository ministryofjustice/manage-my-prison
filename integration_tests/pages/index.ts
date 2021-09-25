import Page, { PageElement } from './page'

export default class IndexPage extends Page {
  constructor() {
    super('Population age')
  }

  headerUserName = (): PageElement => cy.get('[data-qa=header-user-name]')
}
