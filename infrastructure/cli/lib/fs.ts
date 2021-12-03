import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import yaml from 'yaml'

/**
 * Reads a JSON file returning an object
 */
export async function readJson(path: string): Promise<unknown> {
  const readHandle = await fs.open(path, 'r')
  const text = await readHandle.readFile({encoding: 'utf8'})
  return JSON.parse(text)
}

/**
 * Reads a YAML file returning an object
 */
export async function readYaml(path: string): Promise<unknown> {
  const readHandle = await fs.open(path, 'r')
  const text = await readHandle.readFile({encoding: 'utf8'})
  return yaml.parse(text)
}

/**
 * Creates a temporary directory, deleting it up once the callback has been run
 */
export async function temporaryDirectory<T>(
  callback: (dir: string) => T | Promise<T>,
  {prefix = 'mmp-'} = {}
): Promise<T> {
  let dir: string | null = null
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
    return await callback(dir)
  } finally {
    if (dir) {
      await fs.rm(dir, {force: true, recursive: true})
    }
  }
}

/**
 * Creates a temporary file, deleting it up once the callback has been run
 * TODO: is `tempfile` better?
 */
export async function temporaryFile<T>(
  callback: (file: string) => T | Promise<T>,
  {prefix = '', ext = '.tmp'} = {}
): Promise<T> {
  return temporaryDirectory(async dir => {
    const random = crypto.pseudoRandomBytes(7).toString('hex')
    const fileName = `${prefix}${random}${ext}`
    const file = path.join(dir, fileName)
    const fd = await fs.open(file, 'w')
    await fd.close()
    return callback(file)
  })
}
