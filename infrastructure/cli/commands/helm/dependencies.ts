import chalk from 'chalk'
import semver from 'semver'

import {chartName, ensureChartsRepositorySetup, helm, hmppsChartRepo} from './index.js'
import {readYaml} from '../../lib/fs.js'
import {makeCommand} from '../../lib/command.js'
import {Verbosity} from '../../lib/misc.js'
import {CommandOptions} from '../../lib/options.js'
import {getMainPath} from '../../lib/paths.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Check dependency chart versions',
  {
    takesEnvironment: false,
  }
)

export async function handler({verbosity}: CommandOptions): Promise<void> {
  await ensureChartsRepositorySetup()

  const chartPath = getMainPath('helm_deploy', chartName, 'Chart.yaml')
  const chart = await readYaml(chartPath)
  // @ts-ignore
  const chartDependencies = chart.dependencies as {name: string, version: string, repository: string}[]
  // hmpps helm chart dependencies
  const dependencyVersions: {[name: string]: semver.Range} = Object.fromEntries(
    chartDependencies
      .filter(item => item.repository === hmppsChartRepo.url)
      .map(item => {
        // eslint-disable-next-line prefer-const
        let {name, version} = item
        return [name, new semver.Range(version)]
      })
  )

  const response = await helm(['search', 'repo', hmppsChartRepo.name, '--output', 'json'], {
    output: 'object',
  }) as any[]
  // all latest hmpps helm charts
  const latestVersions: {[name: string]: string} = Object.fromEntries(
    response.map(item => {
      let {name, version} = item
      const longRepoName = new RegExp(`^(?<prefix>${hmppsChartRepo.name}/)?(?<name>.+)`)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name = longRepoName.exec(name)!.groups!.name
      version = semver.parse(version)
      return [name, version]
    })
  )

  let updatesExist = false
  for (const [name, version] of Object.entries(dependencyVersions)) {
    const latestVersion = latestVersions[name]
    if (!latestVersion) {
      process.stderr.write(chalk.red(`Cannot find dependency ${name} and it’s latest version!\n`))
    }
    if (semver.gtr(latestVersion, version)) {
      process.stderr.write(chalk.yellow(`Dependency ${name} can be updated from ${version} to ${latestVersion}.\n`))
      updatesExist = true
    } else if (verbosity > Verbosity.normal) {
      process.stderr.write(chalk.green(`Dependency ${name} requires latest known version ${latestVersion}.\n`))
    }
  }
  if (updatesExist) {
    process.stderr.write(chalk.yellow(`Edit ${chartPath} to update dependency versions.\n`))
  }
}
