import * as assert from 'assert/strict'
import {URL} from 'url'

import {Argv, CommandModule, Options} from 'yargs'

import {Positional, environmentPositional} from './options.js'

export interface Command extends CommandModule {
  description: string
  parentCommand?: ContainerCommand
}

export interface ContainerCommand extends Command {
  updateCommand(module: any): void
  get isEmpty(): boolean
  get childCommands(): Command[]
  get hasChildCommands(): boolean
  attachChildCommand(command: Command): void
  detachChildCommand(command: Command): void
}

export function commandIsContainer(command: Command): command is ContainerCommand {
  return 'updateCommand' in command
}

type MakeCommandOptions = {
  takesEnvironment?: boolean
  requiredPositionals?: Positional[]
  optionalPositionals?: Positional[]
  options?: {[name: string]: Options}
}

/**
 * Used by commands to set up common module-level variables for yargs:
 * - command (generated name and positional arguments of the command)
 * - description
 * - builder (generated)
 * - handler must be defined in the module itself
 */
export function makeCommand(
  importUrl: string,
  description: string,
  {takesEnvironment = true, requiredPositionals = [], optionalPositionals = [], options = {}}: MakeCommandOptions = {}
): Omit<Command, 'handler'> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let command = new URL(importUrl).pathname
    .split('/')
    .at(-1)!
    .replace(/.(ts|js)$/, '')
  if (takesEnvironment) {
    if (!requiredPositionals) {
      requiredPositionals = []
    }
    requiredPositionals.unshift(environmentPositional)
  }
  for (const positional of requiredPositionals) {
    assert.ok(positional.name, 'Positionals require a name')
    command += ` <${positional.name}>`
  }
  for (const positional of optionalPositionals) {
    assert.ok(positional.name, 'Positionals require a name')
    command += ` [${positional.name}]`
  }

  function builder(yargs: Argv): Argv {
    for (const positional of requiredPositionals) {
      const name = positional.name
      // @ts-ignore
      delete positional.name
      yargs = yargs.positional(name, positional)
    }
    for (const positional of optionalPositionals) {
      const name = positional.name
      // @ts-ignore
      delete positional.name
      yargs = yargs.positional(name, positional)
    }
    for (const [name, option] of Object.entries(options)) {
      yargs = yargs.option(name, option)
    }
    return yargs
  }

  return {command, description, builder}
}
