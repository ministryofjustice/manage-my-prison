import * as readline from 'readline'

import chalk from 'chalk'

import {Environment} from './cluster.js'

type ConfirmOptions = {
  proceedByDefault?: boolean
  proceedUnlessProduction?: Environment
}

/**
 * Prompts user to continue; used for potentially-dangerous actions
 */
export async function confirm<T>(
  question: string,
  callback: () => T,
  {proceedByDefault = false, proceedUnlessProduction = undefined}: ConfirmOptions = {}
): Promise<T | null> {
  // TODO: once 'prod' is an option for Environment, change to:
  // if (proceedUnlessProduction !== undefined && proceedUnlessProduction !== 'prod') {
  if (proceedUnlessProduction === 'dev') {
    process.stderr.write(`${question}\nAutomatically proceeding on non-production…\n`)
    return callback()
  }
  const prompt = proceedByDefault ? chalk.green('Y/n') : chalk.red('y/N')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    tabSize: 4,
  })
  return new Promise((resolve, reject) => {
    rl.question(`${question} [${prompt}]: `, async input => {
      const defaultAnswer = proceedByDefault ? 'y' : 'n'
      input = input.trim().toLowerCase() || defaultAnswer
      const proceed = ['y', 'yes', 'true'].includes(input)
      try {
        if (proceed) {
          resolve(callback())
        } else {
          resolve(null)
        }
      } catch (error) {
        reject(error)
      } finally {
        rl.close()
      }
    })
  })
}
