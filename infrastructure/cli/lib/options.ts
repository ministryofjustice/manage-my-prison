import {PositionalOptions} from 'yargs'

import {ENVIRONMENTS, Environment} from './cluster.js'
import {Verbosity} from './misc.js'

// yargs types (used in command builders)

export interface Positional extends PositionalOptions {
  name: string
}

export const environmentPositional: Positional = {
  name: 'environment',
  description: 'Cloud Platform environment',
  choices: ENVIRONMENTS,
}

// command types (used in command handlers)

export interface CommandOptions {
  verbosity: Verbosity
}

export interface EnvironmentOptions extends CommandOptions {
  environment: Environment
}
