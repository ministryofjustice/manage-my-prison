import {DeploymentOptions} from './index.js'
import {Client as EcrClient} from '../ecr/index.js'
import {makeCommand} from '../../lib/command.js'
import {namespace} from '../../lib/cluster.js'
import {KubernetesApi} from '../../lib/kubernetes.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List app versions',
  {
    optionalPositionals: [
      {
        name: 'deployment',
        description: 'Only this deployment',
      },
    ],
  }
)

export async function handler({environment, deployment}: DeploymentOptions): Promise<void> {
  const ecrClient = await EcrClient.load(environment)
  const ns = namespace(environment)
  const kubernetes = new KubernetesApi()
  const labelSelector = deployment ? `app=${deployment}` : undefined
  const response = await kubernetes.appsV1Api.listNamespacedDeployment(
    ns,
    undefined,
    undefined,
    undefined,
    undefined,
    labelSelector
  )
  const deployments = response.body.items.map(deployment => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const name = deployment.metadata!.name!
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const labelVersion = deployment.metadata!.labels!['app.kubernetes.io/version']
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const image = ecrClient.abbreviateImage(deployment!.spec!.template.spec!.containers![0].image!)
    const readyCount = deployment.status?.readyReplicas || 0
    const availableCount = deployment.status?.availableReplicas || 0
    const count = deployment.status?.replicas || 0
    const podAvailability = `${readyCount}/${availableCount}/${count}`
    return {name, labelVersion, image, podAvailability}
  })
  const columns = [
    {key: 'name', name: 'Deployment'},
    {key: 'labelVersion', name: 'Version'},
    {key: 'podAvailability', name: 'Ready/Available/Selected'},
    {key: 'image', name: 'Image'},
  ]
  printTable(deployments, columns)
}
