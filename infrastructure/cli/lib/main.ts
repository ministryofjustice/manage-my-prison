import {AssertionError} from 'assert'
import * as fs from 'fs/promises'
import * as inspector from 'inspector'
import * as path from 'path'

import chalk from 'chalk'
import yargs, {CommandModule} from 'yargs'
import {hideBin} from 'yargs/helpers'

import {Command, commandIsContainer, ContainerCommand} from './command.js'
import {Verbosity} from './misc.js'
import {getCliPath} from './paths.js'

declare module 'yargs' {
  // eslint-disable-next-line @typescript-eslint/ban-types
  export interface Argv<T = {}> {
    // NB: yargs type definitions are missing this form
    command<U>(commands: CommandModule<T, U>[]): Argv<U>
  }
}

export async function main(): Promise<void> {
  if (inspector.url()) {
    process.stderr.write('\n')
  }

  let verbosity: Verbosity = Verbosity.normal

  // NB: `Argv.commandDir` does not work with ESM yet so find and load commands manually
  const commands = await findCommands()

  await yargs(hideBin(process.argv))
    .scriptName('$️')
    .option('verbosity', {
      choices: [Verbosity.silent, Verbosity.normal, Verbosity.loud],
      default: verbosity,
      type: 'number',
      global: true,
      description: 'Logging level',
    })
    .command(commands)
    .alias({h: 'help'})
    .version(false)
    .demandCommand()
    .recommendCommands()
    .strict(true)
    .middleware(yargs => {
      if ('verbosity' in yargs) {
        // extract verbosity option as it is not available in `fail` callback
        verbosity = yargs.verbosity as Verbosity
      }
    })
    .fail((parserMessage, error, yargs) => {
      if (parserMessage) {
        yargs.showHelp()
        process.stderr.write(`\n${chalk.red('Parser error')}: ${parserMessage}\n`)
      }
      if (error) {
        if (verbosity > Verbosity.normal) {
          console.error(error)
        } else if (error instanceof AssertionError && !error.generatedMessage) {
          process.stderr.write(`${chalk.red(error.message)}\n`)
        } else if (!('name' in error) || !('message' in error)) {
          // in case a non Error was thrown
          console.error(error)
        } else {
          process.stderr.write(`${chalk.red(error.name)}: ${error.message}\n`)
        }
      }
      process.exit(1)
    })
    .parse()
}

async function findCommands(): Promise<Command[]> {
  const rootPath = getCliPath('commands')
  const rootCommands: Command[] = []
  for await (const command of scanPath(rootPath)) {
    if (!command.parentCommand) {
      rootCommands.push(command)
    }
  }
  const emptyRootCommands: Command[] = []
  for (const command of rootCommands) {
    const empty = pruneEmptyContainerCommand(command)
    if (empty) {
      emptyRootCommands.push(command)
    }
  }
  return rootCommands
    .filter(command => !emptyRootCommands.includes(command))
}

async function* scanPath(rootPath: string, parentCommand?: ContainerCommand): AsyncGenerator<Command, void, void> {
  const children = (await fs.readdir(rootPath))
    .filter(name => !name.startsWith('.'))
    .map(async name => {
      const fullPath = path.join(rootPath, name)
      return {
        name: name,
        path: fullPath,
        stat: await fs.stat(fullPath),
      }
    })
  for await (const child of children) {
    if (child.stat.isFile() && (child.name.endsWith('.ts') || child.name.endsWith('.js'))) {
      const module = await import(child.path)
      if (child.name === 'index.ts' || child.name === 'index.js') {
        if (parentCommand) {
          // complete empty parent container command
          parentCommand.updateCommand(module)
        }
      } else if (isCommandModule(module)) {
        // make new command and attach to parent
        const command = registerCommand(module, parentCommand)
        yield command
      }
    } else if (child.stat.isDirectory()) {
      // make new container command
      const command = registerContainerCommand(child.name, parentCommand)
      yield command
      yield* await scanPath(child.path, command)
    }
  }
}

function isCommandModule(module: any): boolean {
  return module.command && module.builder && module.handler
}

function hierarchicalCommandName(command: Command): string {
  const hierarchy = []
  let cmd: Command | undefined = command
  do {
    hierarchy.push(cmd.command)
    cmd = cmd.parentCommand
  } while (cmd)
  hierarchy.reverse()
  return hierarchy.join('›')
}

function registerCommand(module: any, parentCommand?: ContainerCommand): Command {
  const command: Command = {
    command: module.command,
    description: module.description || '',
    builder: module.builder,
    handler: module.handler,
  }
  if (parentCommand) {
    parentCommand.attachChildCommand(command)
  }
  return command
}

function registerContainerCommand(name: string, parentCommand?: ContainerCommand): ContainerCommand {
  const childCommands: Command[] = []
  let containerCommandHasHandler = false
  let nonContainerBuilder: any = null
  const command: ContainerCommand = {
    command: name,
    description: '',
    builder: (yargs) => {
      if (command.hasChildCommands && nonContainerBuilder) {
        throw new Error(
          `Container command ${hierarchicalCommandName(command)} has child commands so cannot have a custom builder`
        )
      } else if (command.hasChildCommands) {
        return yargs
          .command(childCommands)
          .demandCommand(containerCommandHasHandler ? 0 : 1)
          .recommendCommands()
          .strict(true)
      } else if (nonContainerBuilder) {
        return nonContainerBuilder(yargs)
      } else {
        throw new Error(`Container command ${hierarchicalCommandName(command)} missing handler and child commands`)
      }
    },
    handler: (argv) => {
      throw new Error(`Container command ${hierarchicalCommandName(command)} called incorrectly with ${argv}`)
    },
    updateCommand(module): void {
      command.description = module.description || ''
      if (module.handler) {
        containerCommandHasHandler = true
        command.handler = module.handler
        if (module.builder) {
          nonContainerBuilder = module.builder
        }
      }
    },
    get isEmpty(): boolean {
      return !this.hasChildCommands && !nonContainerBuilder
    },
    get childCommands(): Command[] {
      return childCommands
    },
    get hasChildCommands(): boolean {
      return childCommands.length !== 0
    },
    attachChildCommand(childCommand): void {
      childCommand.parentCommand = command
      childCommands.push(childCommand)
    },
    detachChildCommand(childCommand: Command): void {
      const index = childCommands.indexOf(childCommand)
      if (index !== -1) {
        childCommands.splice(index, 1)
        childCommand.parentCommand = undefined
      } else {
        throw new Error(`Cannot find ${childCommand.command} child command in ${command.command}`)
      }
    },
  }
  if (parentCommand) {
    parentCommand.attachChildCommand(command)
  }
  return command
}

function pruneEmptyContainerCommand(command: Command): boolean {
  if (commandIsContainer(command)) {
    const toDetach = []
    for (const childCommand of command.childCommands) {
      const empty = pruneEmptyContainerCommand(childCommand)
      if (empty) {
        toDetach.push(childCommand)
      }
    }
    for (const childCommand of toDetach) {
      command.detachChildCommand(childCommand)
    }
    if (command.isEmpty) {
      return true
    }
  }
  return false
}
