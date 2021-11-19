import $ from 'jquery'
import GOVUKFrontend from 'govuk-frontend'
import MOJFrontend from '@ministryofjustice/frontend' // NB: requires jquery $ global

window.$ = $
GOVUKFrontend.initAll()
MOJFrontend.initAll()
