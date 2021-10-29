import {versionRegex} from '../app/index.js'
import {appName} from '../../lib/app.js'
import {Environment} from '../../lib/cluster.js'
import {getMainPath} from '../../lib/paths.js'
import {OutputOptions, subprocess} from '../../lib/subprocess.js'

export const description = 'Manage Helm releases'

export const chartName = appName
export const releaseName = appName

export function coerceVersion(version: string): string {
  if (versionRegex.test(version)) {
    return version
  } else {
    throw new Error('Version is not in the form [date].[build number].[commit hash]')
  }
}

export function valuesFileName(environment: Environment) {
  return `values-${environment}.yaml`
}

export async function helm(args: string[], options: {output: 'stdout'}): Promise<void>
export async function helm(args: string[], options: {output: 'text'}): Promise<string>
export async function helm(args: string[], options?: OutputOptions): Promise<unknown>
export async function helm(args: string[], options: Partial<OutputOptions> = {}): Promise<unknown> {
  const chartPath = getMainPath('helm_deploy')
  return await subprocess('helm', args, {cwd: chartPath, ...options})
}

export const hmppsChartRepo = {
  name: 'hmpps-helm-charts',
  url: 'https://ministryofjustice.github.io/hmpps-helm-charts',
}

export async function ensureChartsRepositorySetup() {
  const chartRepos = await helm(['repo', 'list', '--output', 'json'], {output: 'object'}) as any[]
  const installed = chartRepos.some(item => item.name === hmppsChartRepo.name && item.url === hmppsChartRepo.url)
  if (!installed) {
    await helm(['repo', 'add', hmppsChartRepo.name, hmppsChartRepo.url])
  }
}

export async function updateHelmDependencies() {
  // ensure correct versions are downloaded because
  // `helm template --dependency-update …` and `helm upgrade --dependency-update …`
  // only update charts if they are entirely missing
  await helm(['dependency', 'update', `./${chartName}`])
}
