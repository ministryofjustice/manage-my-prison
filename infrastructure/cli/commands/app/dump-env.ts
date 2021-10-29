import chalk from 'chalk'

import {DeploymentOptions, DeploymentPositional} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {DEPLOYMENT, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {seemsSensitive, styleKeyValues} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Dump environment from pods',
  {
    optionalPositionals: [DeploymentPositional],
  }
)

export async function handler({environment, deployment = DEPLOYMENT}: DeploymentOptions): Promise<void> {
  const ns = namespace(environment)
  const kubernetes = new KubernetesApi()
  const pods = await kubernetes.getPodNames(ns, deployment)
  if (!pods.length) {
    process.stderr.write('No pods found to run command on.\n')
  } else {
    const envs = pods.map(async (pod) => {
      const response = await kubernetes.exec(
        ns, pod, ['printenv'],
        {output: 'text'},
      )
      const env: [string, string][] = response.split('\n')
        .sort()
        .filter(line => line.length > 0)
        .map(line => line.split('=', 2) as [string, string])
      return [pod, env]
    })
    const allEnvsEqual = Symbol()
    const envTable: {[key: string]: {[pod: string]: string, [all: symbol]: boolean}} = {}
    for await (const [pod, env] of envs) {
      for (const [key, value] of env) {
        if (typeof envTable[key] === 'undefined') {
          envTable[key] = {}
        }
        envTable[key][pod as string] = value
      }
    }
    for (const envs of Object.values(envTable)) {
      const values = Object.values(envs)
      envs[allEnvsEqual] = values.slice(1)
        .every(value => value === values[0])
    }
    const firstPod = pods[0]
    for (const [key, envs] of Object.entries(envTable)) {
      const sensitive = seemsSensitive(key)
      const {styleKey, styleValue, styleSeparator} = styleKeyValues(sensitive)
      const firstValue = envs[firstPod]
      let suffix = ''
      if (!envs[allEnvsEqual]) {
        const differences = Object.entries(envs)
          .filter(([pod]) => ![firstPod, '*'].includes(pod))
          .map(([pod, value]) => `${chalk.grey(pod + '→')}${styleValue(value)}`)
          .join(chalk.grey(', '))
        suffix = `${chalk.grey('  # differs: ')}${differences}`
      }
      process.stdout.write(`${styleKey(key)}${styleSeparator('=')}${styleValue(firstValue)}${suffix}\n`)
    }
  }
}
