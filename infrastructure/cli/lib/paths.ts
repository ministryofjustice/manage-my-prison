import * as path from 'path'
import {URL} from 'url'

/**
 * Path to dirctory containing script (replaces __dirname in ESM mode)
 */
export function scriptParentDirectory(importMetaUrl: string): string {
  const scriptPath = new URL(importMetaUrl).pathname
  return path.dirname(scriptPath)
}

let cliPath: string | null = null

export function setCliPath(newCliPath: string): void {
  if (cliPath) {
    throw new Error('Package path already set')
  }
  cliPath = newCliPath
}

/**
 * Path relative to CLI package
 */
export function getCliPath(...items: string[]): string {
  if (!cliPath) {
    throw new Error('Package path accessed before being set')
  }
  return path.resolve(cliPath, ...items)
}

/**
 * Path relative to main project package
 */
export function getMainPath(...items: string[]): string {
  return getCliPath('..', '..', ...items)
}
