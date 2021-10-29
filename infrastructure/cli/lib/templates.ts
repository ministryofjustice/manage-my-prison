import nunjucks from 'nunjucks'

import {ingressUrl, namespace} from './cluster.js'
import {shortDate} from './misc.js'
import {getCliPath} from './paths.js'

nunjucks.installJinjaCompat()
const templatePath = getCliPath('templates')
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(templatePath),
  {autoescape: true},
)
env.addFilter('ingressUrl', ingressUrl)
env.addFilter('namespace', namespace)
env.addFilter('shortDate', shortDate)

type Context = {[key: string]: unknown}

export function renderTemplate(template: string, context: Context = {}): string {
  return env.render(template, context)
}
