import {CommandModule} from 'yargs'

declare module 'yargs' {
  // eslint-disable-next-line @typescript-eslint/ban-types
  export interface Argv<T = {}> {
    // NB: yargs type definitions are missing this form
    command<U>(commands: CommandModule<T, U>[]): Argv<U>
  }
}
