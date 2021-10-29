import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import yaml from 'yaml'

export async function readJson(path: string): Promise<unknown> {
  const readHandle = await fs.open(path, 'r')
  const text = await readHandle.readFile({encoding: 'utf8'})
  return JSON.parse(text)
}

export async function readYaml(path: string): Promise<unknown> {
  const readHandle = await fs.open(path, 'r')
  const text = await readHandle.readFile({encoding: 'utf8'})
  return yaml.parse(text)
}

export async function temporaryDirectory<T>(
  callback: (dir: string) => T | Promise<T>,
  {prefix = 'mmp-'} = {}
): Promise<T> {
  let dir: string | null = null
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
    const value = callback(dir)
    if ('then' in value) {
      return await value
    }
    return value
  } finally {
    if (dir) {
      await fs.rm(dir, {force: true, recursive: true})
    }
  }
}

// TODO: is tempfile better?
export async function temporaryFile<T>(
  callback: (file: string) => T | Promise<T>,
  {prefix = '', ext = '.tmp'} = {}
): Promise<T> {
  return await temporaryDirectory(async dir => {
    const random = crypto.pseudoRandomBytes(7).toString('hex')
    const fileName = `${prefix}${random}${ext}`
    const file = path.join(dir, fileName)
    const fd = await fs.open(file, 'w')
    await fd.close()
    const value = callback(file)
    if ('then' in value) {
      return await value
    }
    return value
  })
}
