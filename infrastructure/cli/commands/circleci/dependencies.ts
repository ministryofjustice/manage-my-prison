import chalk from 'chalk'
import fetch from 'node-fetch'
import semver from 'semver'

import {hmppsOrbName} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {readYaml} from '../../lib/fs.js'
import {shortDate} from '../../lib/misc.js'
import {getMainPath} from '../../lib/paths.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Check CircleCI orb version',
  {
    takesEnvironment: false,
  }
)

export async function handler(): Promise<void> {
  const configPath = getMainPath('.circleci', 'config.yml')
  const circleCiConfig = await readYaml(configPath)
  // @ts-ignore
  const orbs = circleCiConfig.orbs as {[name: string]: string}
  const hmppsOrbVersion = Object.entries(orbs)
    .filter(([, fullVersion]) => fullVersion.startsWith(`${hmppsOrbName}@`))
    .map(([, fullVersion]) => fullVersion.slice(hmppsOrbName.length + 1))[0]
  if (!hmppsOrbVersion) {
    process.stderr.write(chalk.red('Cannot determine required version of HMPPS CircleCI Orb\n'))
    return
  }
  process.stderr.write(`Required version of HMPPS CircleCI Orb is ${chalk.green(hmppsOrbVersion)}\n`)

  const orb = await getOrbVersion(hmppsOrbName)
  process.stderr.write(
    `Latest HMPPS CircleCI Orb version is ${chalk.green(orb.version)} created at ${shortDate(orb.createdAt)}\n`
  )

  const latestVersionSatisfiesRequirement = semver.satisfies(orb.version, hmppsOrbVersion)
  if (!latestVersionSatisfiesRequirement) {
    process.stderr.write(
      chalk.yellow(`Edit ${configPath} to update HMPPS CircleCI Orb dependency version to ${orb.version}.\n`)
    )
  }
}

type OrbVersion = {
  createdAt: Date
  version: string
}

async function getOrbVersion(orbName: string): Promise<OrbVersion> {
  // GraphQL query gleaned from inspecting network requests at:
  // https://circleci.com/developer/orbs/orb/ministryofjustice/hmpps
  const request = {
    operationName: 'OrbDetailsQuery',
    variables: {
      name: orbName,
      orbVersionRef: `${orbName}@volatile`,
    },
    query: `
      query OrbDetailsQuery($name: String, $orbVersionRef: String) {
        orbVersion(orbVersionRef: $orbVersionRef) {
          createdAt
          version
        }
      }
    `,
  }
  const response = await fetch('https://circleci.com/graphql-unstable', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible)',
    },
    body: JSON.stringify(request),
  })
  const data = await response.json()
  // @ts-ignore
  const {createdAt, version}: {[key: string]: string} = data.data.orbVersion
  return {createdAt: new Date(Date.parse(createdAt)), version}
}
