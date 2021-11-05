/**
 * Traps interrupt signal while the `execute` callback is running.
 * The `signalListener` callback is intended to cancel the `execute`’s progress on CTRL-C.
 * Useful for cancelling a long-running/indefinte task from the CLI.
 */
export async function trapInterruptSignal<T>(execute: () => T | Promise<T>, trap: () => void): Promise<T | null> {
  let value: T | Promise<T> | null = null
  try {
    process.on('SIGINT', trap)
    value = execute()
    if ('then' in value) {
      value = await value
    }
  } finally {
    process.off('SIGINT', trap)
  }
  return value
}
