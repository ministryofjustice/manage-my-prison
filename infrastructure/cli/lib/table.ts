import chalk from 'chalk'

type Row = {[key: string]: string | [string, number]}
type Column = {name: string, key: string}
type ColumnInput = string | Column

type TableOptions = {
  borders?: boolean
}

export function* table(
  rows: Row[],
  columns: ColumnInput[],
  {borders = true}: TableOptions = {},
): Generator<string, void, void> {
  const columnKeys: Column[] = columns.map(column => {
    if (typeof column === 'string') {
      return {name: column, key: column}
    }
    return column
  })
  const separator = borders ? ' │ ' : '  '
  const columnWidths = Object.fromEntries(
    columnKeys.map(({name, key}) => {
      const maxWidth = rows
        .map(row => {
          const value = row[key]
          if (Array.isArray(value)) {
            const [, width] = value
            return width
          } else {
            return value.length
          }
        })
        .reduce((max, width) => Math.max(max, width), name.length)
      return [key, maxWidth]
    })
  )
  yield columnKeys
    .map(({name, key}) => name.padEnd(columnWidths[key]))
    .join(separator)
  if (borders) {
    yield columnKeys
      .map(({key}) => '─'.repeat(columnWidths[key]))
      .join('─┼─')
  }
  for (const row of rows) {
    yield columnKeys
      .map(({key}) => {
        let value = row[key]
        if (Array.isArray(value)) {
          // eslint-disable-next-line init-declarations
          let width
          [value, width] = value
          return value + ' '.repeat(columnWidths[key] - width)
        } else {
          return value.padEnd(columnWidths[key])
        }
      })
      .join(separator)
  }
}

export function printTable(rows: Row[], columns: ColumnInput[], {borders = true}: TableOptions = {}): void {
  const lines = table(rows, columns, {borders})
  for (const line of lines) {
    process.stdout.write(line)
    process.stdout.write('\n')
  }
}

export function seemsSensitive(key: string): boolean {
  key = key.toLowerCase()
  return ['secret', 'token', 'key', 'password'].some(word => key.includes(word))
}

type Styler = (s: string) => string
type Styles = {
  styleKey: Styler
  styleValue: Styler
  styleSeparator: Styler
}

export function styleKeyValues(sensitive: boolean): Styles {
  // eslint-disable-next-line init-declarations
  let styleKey, styleValue, styleSeparator
  if (sensitive) {
    styleKey = chalk.hex('#ff76b6')
    styleValue = chalk.black
    styleSeparator = chalk.grey
  } else {
    styleKey = chalk.hex('#76d6ff')
    styleValue = (s: string) => s
    styleSeparator = chalk.grey
  }
  return {styleKey, styleValue, styleSeparator}
}
