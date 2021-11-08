import {spawn, StdioNull, StdioPipe} from 'child_process'

export type OutputOptions = {output: 'stdout' | 'object' | 'text'}

export type SubprocessOptions = {
  cwd?: string
  env?: {[name: string]: string}
  exitOnError?: boolean
  input?: string
  signal?: AbortSignal
} & Partial<OutputOptions>

export class SubprocessError extends Error {
  constructor(readonly message: string, readonly code: number, readonly stderr: string) {
    super(message)
  }
}

/**
 * Launches a child process
 * - normally inherits stdout and stderr from parent process
 * - but can instead collect child’s stdout as a string or a JSON object
 * - normally kills parent process if the child exits with a non-zero code
 * - but can instead collect child’s stderr and throw a SubprocessError
 * - optionally pipes string input to the child’s stdin
 * TODO: is `execa` better?
 */
export async function subprocess(
  executable: string,
  args?: string[],
  options?: Omit<SubprocessOptions, 'output'>
): Promise<void>
export async function subprocess(
  executable: string,
  args: string[],
  options: SubprocessOptions & {output: 'stdout'}
): Promise<void>
export async function subprocess(
  executable: string,
  args: string[],
  options: SubprocessOptions & {output: 'text'}
): Promise<string>
export async function subprocess(
  executable: string,
  args: string[],
  options: SubprocessOptions
): Promise<unknown>
export async function subprocess(
  executable: string,
  args: string[] = [],
  {
    cwd = undefined,
    env = undefined,
    exitOnError = true,
    input = undefined,
    output = 'stdout',
    signal = undefined,
  }: SubprocessOptions = {}
): Promise<void | string | unknown> {
  const stdin: StdioNull | StdioPipe = typeof input === 'undefined' ? 'ignore' : 'pipe'
  const stdout: StdioNull | StdioPipe = output === 'stdout' ? 'inherit' : 'pipe'
  const stderr: StdioNull | StdioPipe = exitOnError ? 'inherit' : 'pipe'
  const options = {
    cwd,
    env,
    signal,
    shell: false,
    stdio: [stdin, stdout, stderr],
  }

  const handle = spawn(executable, args, options)
  return new Promise((resolve, reject) => {
    if (typeof input !== 'undefined' && handle.stdin) {
      handle.stdin.write(input, 'utf8', () => {
        handle.stdin?.end()
      })
    }

    const stderrChunks: string[] = []

    if (!exitOnError && handle.stderr) {
      handle.stderr.setEncoding('utf8')
      handle.stderr.on('data', (data) => {
        stderrChunks.push(data)
      })
    }

    const stdoutChunks: string[] = []

    if (output !== 'stdout' && handle.stdout) {
      handle.stdout.setEncoding('utf8')
      handle.stdout.on('data', (data) => {
        stdoutChunks.push(data)
      })
    }

    handle.on('close', (exitCode) => {
      if (exitCode) {
        if (exitOnError) {
          process.exit(exitCode)
        }
        const stderrText = stderrChunks.join()
        const error = new SubprocessError(
          `Subprocess ${executable} exited with error code ${exitCode}`,
          exitCode,
          stderrText,
        )
        reject(error)
      } else if (output === 'stdout') {
        resolve(undefined)
      } else {
        const stdoutText = stdoutChunks.join()
        if (output === 'text') {
          resolve(stdoutText)
        } else if (output === 'object') {
          const object = JSON.parse(stdoutText)
          resolve(object)
        } else {
          reject(new Error(`Implementation error - output type "${output}" not handled`))
        }
      }
    })
  })
}
