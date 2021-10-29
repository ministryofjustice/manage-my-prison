import {setTimeout} from 'timers/promises'

import {DeploymentPositional, DeploymentOptions} from './index.js'
import {makeCommand} from '../../lib/command.js'
import {DEPLOYMENT, namespace} from '../../lib/cluster.js'
import {confirm} from '../../lib/interactive.js'
import {KubernetesApi} from '../../lib/kubernetes.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'Delete deployment’s pods one-by-one to have them recreated',
  {
    optionalPositionals: [DeploymentPositional],
  }
)

export async function handler({environment, deployment = DEPLOYMENT}: DeploymentOptions): Promise<void> {
  const ns = namespace(environment)
  const kubernetes = new KubernetesApi()
  const pods = await kubernetes.getPodNames(ns, deployment)
  if (!pods.length) {
    process.stderr.write('No pods found to delete.\n')
  } else {
    const api = kubernetes.coreApi
    const informerController = new AbortController()
    const deletedPods: Set<string> = new Set()
    await kubernetes.startWatching(
      `/api/v1/namespaces/${ns}/pods`,
      () => api.listNamespacedPod(ns),
      informerController.signal,
      {
        deleted(pod) {
          if (pod.metadata?.name) {
            const name = pod.metadata.name
            deletedPods.add(name)
          }
        },
      }
    )
    const hasBeenDeleted = async (pod: string): Promise<void> => {
      for (;;) {
        if (deletedPods.has(pod)) {
          return
        }
        await setTimeout(1000)
      }
    }
    await confirm(`Are you sure you want to recycle ${pods.length} pods?`, async () => {
      for (const pod of pods) {
        process.stderr.write(`Deleting pod "${pod}"…\n`)
        await api.deleteNamespacedPod(pod, ns)
        await hasBeenDeleted(pod)
        process.stderr.write('Deleted\n')
      }
    })
    informerController.abort()
  }
}
