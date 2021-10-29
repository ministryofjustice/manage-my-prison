import * as fs from 'fs/promises'
import * as path from 'path'

import {execScript} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {EnvironmentOptions} from '../../lib/options.js'
import {namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {collect} from '../../lib/misc.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Run a script in node on all pods',
  {
    optionalPositionals: [
      {
        name: 'script',
        description: 'Script file (defaults to stdin)',
      },
    ],
    options: {
      'one-pod': {
        boolean: true,
        description: 'Runs the script only on the first pod',
      },
    },
  }
)

interface Options extends EnvironmentOptions {
  script: string
  onePod?: boolean
}

export async function handler({environment, script, onePod = false}: Options): Promise<void> {
  const input = await loadScript(script)
  const ns = namespace(environment)
  const kubernetes = new KubernetesApi()
  let pods = await kubernetes.getPodNames(ns)
  if (!pods.length) {
    process.stderr.write('No pods found to run script on.\n')
  } else {
    if (onePod) {
      pods = [pods[0]]
    }
    for (const pod of pods) {
      await execScript({namespace: ns, pod, input})
    }
  }
}

async function loadScript(script?: string): Promise<string> {
  if (!script) {
    const chunks: any[] = await collect(process.stdin)
    return Buffer.concat(chunks).toString('utf8')
  } else {
    const openFromPath = path.resolve(script)
    const readHandle = await fs.open(openFromPath, 'r')
    return readHandle.readFile({encoding: 'utf8'})
  }
}
