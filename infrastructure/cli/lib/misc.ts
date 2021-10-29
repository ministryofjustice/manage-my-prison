export type Port = number | string

export enum Verbosity {
  silent = 0,
  normal = 1,
  loud = 2,
}

/**
 * Kebab/snake case
 */
export function changeCase(string: string, {separator = '-'} = {}): string {
  return string
    .split('')
    .map(c => {
      if (c === c.toUpperCase()) {
        return `${separator}${c.toLowerCase()}`
      } else {
        return c
      }
    })
    .join('')
}

export function shortDate(date: number | string | Date | undefined): string {
  if (typeof date === 'string') {
    date = new Date(Date.parse(date))
  } else if (typeof date === 'number') {
    date = new Date(date)
  }
  if (date instanceof Date) {
    const [day, month, year] = date.toLocaleDateString('en-GB', {timeZone: 'Europe/London'}).split('/')
    return `${year}-${month}-${day}`
  }
  return date || 'Unknown date'
}

export function shortDateTime(date: number | string | Date | undefined): string {
  if (typeof date === 'string') {
    date = new Date(Date.parse(date))
  } else if (typeof date === 'number') {
    date = new Date(date)
  }
  if (date instanceof Date) {
    const [day, month, year] = date.toLocaleDateString('en-GB', {timeZone: 'Europe/London'}).split('/')
    const [hour, minute] = date.toLocaleTimeString('en-GB', {timeZone: 'Europe/London'}).split(':')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
  return date || 'Unknown date/time'
}

export function shortDigest(imageDigest: string): string {
  if (imageDigest.startsWith('sha256:')) {
    return imageDigest.substring(7, 14)
  }
  return imageDigest
}

export function bytes(size: number): string {
  const suffixes = ['B', 'KiB', 'MiB', 'GiB']
  for (const suffix of suffixes) {
    if (size < 1024) {
      return `${Math.round(size)}${suffix}`
    }
    size /= 1024
  }
  return `${Math.round(size)}TiB`
}

export async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = []
  for await (const item of it) {
    collected.push(item)
  }
  return collected
}
