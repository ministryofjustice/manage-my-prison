#!/usr/bin/env npx ts-node
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const target = resolve(process.cwd(), 'build-info.json')

function getEnvironmentVariable(name: string): string {
  if (process.env[name]) {
    return process.env[name]
  }
  throw new Error(`Missing env var ${name}`)
}

writeFileSync(
  target,
  JSON.stringify({
    buildNumber: getEnvironmentVariable('BUILD_NUMBER'),
    gitRef: getEnvironmentVariable('GIT_REF'),
  })
)
