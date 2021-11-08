import {DeploymentPositional, DeploymentOptions} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {DEPLOYMENT, namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Run a command on all pods',
  {
    requiredPositionals: [
      {
        name: 'command',
        description: 'Command to run',
      },
    ],
    optionalPositionals: [DeploymentPositional],
    options: {
      'one-pod': {
        boolean: true,
        default: false,
        description: 'Runs the command only on the first pod',
      },
      stdin: {
        boolean: true,
        default: false,
        implies: 'one-pod',
        description: 'Pipe stdin to remote command',
      },
    },
  }
)

interface Options extends DeploymentOptions {
  command: string
  onePod?: boolean
  stdin?: boolean
}

export async function handler({
  environment,
  deployment = DEPLOYMENT,
  command,
  onePod = false,
  stdin = false,
}: Options): Promise<void> {
  const ns = namespace(environment)
  const kubernetes = new KubernetesApi()
  let pods = await kubernetes.getPodNames(ns, deployment)
  if (!pods.length) {
    process.stderr.write('No pods found to run command on.\n')
  } else {
    if (onePod) {
      pods = [pods[0]]
    }
    let input = undefined
    if (stdin) {
      input = process.stdin
    }
    for (const pod of pods) {
      process.stderr.write(`Running command on pod "${pod}"…\n`)
      await kubernetes.exec(
        ns, pod, ['/bin/sh', '-e', '-c', command],
        {input},
      )
    }
  }
}
