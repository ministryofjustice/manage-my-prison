import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {namespace} from '../../lib/cluster.js'
import {confirm} from '../../lib/interactive.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {seemsSensitive, styleKeyValues} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Read secret from Cloud Platform',
  {
    requiredPositionals: [
      {
        name: 'secret',
        description: 'Name of secret',
      },
    ],
  }
)

interface Options extends EnvironmentOptions {
  secret: string
}

export async function handler({environment, secret}: Options): Promise<void> {
  await confirm('Are you sure you want to print the secret?', async () => {
    const ns = namespace(environment)
    const kubernetes = new KubernetesApi()
    const data = await kubernetes.getDecodedSecret(ns, secret)
    if (!data) {
      process.stderr.write(`Secret “${secret}” not found in ${ns}\n`)
      return
    }
    process.stderr.write(`“${secret}” in ${ns}\n\n`)
    for (const key of Object.keys(data).sort()) {
      const value = data[key]
      const sensitive = seemsSensitive(key)
      const {styleKey, styleValue, styleSeparator} = styleKeyValues(sensitive)
      process.stdout.write(`${styleKey(key)}${styleSeparator('=')}${styleValue(value)}\n`)
    }
  })
}
