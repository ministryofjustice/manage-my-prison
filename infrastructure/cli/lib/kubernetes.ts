import assert from 'assert/strict'
import {once} from 'events'
import {createServer, Server} from 'net'
import {Readable, Writable} from 'stream'
import {setTimeout} from 'timers/promises'

import {KubeConfig, HttpError, KubernetesObject, ListPromise} from '@kubernetes/client-node'
import {CoreV1Api, AppsV1Api, BatchV1Api, ExtensionsV1beta1Api} from '@kubernetes/client-node'
import {V1ConfigMap, V1Secret, V1Status} from '@kubernetes/client-node'
import {V1Container, V1Deployment, V1Ingress, V1Job, V1Pod, V1ReplicaSet, V1Service} from '@kubernetes/client-node'
import {Exec, makeInformer, Informer, ObjectCallback, PortForward} from '@kubernetes/client-node'

import {cliPackageName} from './app.js'
import {CONTEXT, DEPLOYMENT, Deployment} from './cluster.js'
import {Port} from './misc.js'
import {trapInterruptSignal} from './signal.js'
import {OutputOptions} from './subprocess.js'

export type Secret = {
  [key: string]: string
}

export type InformerCallbacks<T extends KubernetesObject> = {
  added?: ObjectCallback<T>
  updated?: ObjectCallback<T>
  deleted?: ObjectCallback<T>
  error?: ObjectCallback<T>
}

export type ExecOptions = {
  container?: string
  input?: string | Iterable<any> | AsyncIterable<any>
  inputEndDelay?: number
  signal?: AbortSignal
} & Partial<OutputOptions>

export type RunPodOptions = {
  port?: Port
  env?: {[key: string]: string}
  args?: string[]
}

export class KubernetesApi {
  readonly config: KubeConfig

  constructor() {
    this.config = new KubeConfig()
    this.config.loadFromDefault()
    assert.equal(this.config.currentContext, CONTEXT, `Current context should be ${CONTEXT}`)
  }

  get coreApi(): CoreV1Api {
    return this.config.makeApiClient(CoreV1Api)
  }

  get appsV1Api(): AppsV1Api {
    return this.config.makeApiClient(AppsV1Api)
  }

  get batchApi(): BatchV1Api {
    return this.config.makeApiClient(BatchV1Api)
  }

  get extensionsApi(): ExtensionsV1beta1Api {
    return this.config.makeApiClient(ExtensionsV1beta1Api)
  }

  async getPods(namespace: string, deployment: Deployment = DEPLOYMENT): Promise<V1Pod[]> {
    const labelSelector = `app=${deployment}`
    return await listResponse(this.coreApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    ))
  }

  async getPodNames(namespace: string, deployment: Deployment = DEPLOYMENT): Promise<string[]> {
    const pods = await this.getPods(namespace, deployment)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return pods.map(pod => pod.metadata!.name!)
  }

  async getPod(namespace: string, name: string): Promise<V1Pod | null> {
    return await itemResponse(this.coreApi.readNamespacedPod(name, namespace))
  }

  async getReplicaSets(namespace: string): Promise<V1ReplicaSet[]> {
    return await listResponse(this.appsV1Api.listNamespacedReplicaSet(namespace))
  }

  async getReplicaSet(namespace: string, name: string): Promise<V1ReplicaSet | null> {
    return await itemResponse(this.appsV1Api.readNamespacedReplicaSet(name, namespace))
  }

  async getDeployments(namespace: string): Promise<V1Deployment[]> {
    return await listResponse(this.appsV1Api.listNamespacedDeployment(namespace))
  }

  async getDeployment(namespace: string, deployment: Deployment = DEPLOYMENT): Promise<V1Deployment | null> {
    return await itemResponse(this.appsV1Api.readNamespacedDeployment(deployment, namespace))
  }

  async getJobs(namespace: string): Promise<V1Job[]> {
    return await listResponse(this.batchApi.listNamespacedJob(namespace))
  }

  async getJob(namespace: string, name: string): Promise<V1Job | null> {
    return await itemResponse(this.batchApi.readNamespacedJob(name, namespace))
  }

  async getServices(namespace: string): Promise<V1Service[]> {
    return await listResponse(this.coreApi.listNamespacedService(namespace))
  }

  async getService(namespace: string, name: string): Promise<V1Service | null> {
    return await itemResponse(this.coreApi.readNamespacedService(name, namespace))
  }

  async getIngresses(namespace: string): Promise<V1Ingress[]> {
    return await listResponse(this.extensionsApi.listNamespacedIngress(namespace))
  }

  async getIngress(namespace: string, name: string): Promise<V1Ingress | null> {
    return await itemResponse(this.extensionsApi.readNamespacedIngress(name, namespace))
  }

  async getConfigMaps(namespace: string): Promise<V1ConfigMap[]> {
    return await listResponse(this.coreApi.listNamespacedConfigMap(namespace))
  }

  async getConfigMap(namespace: string, name: string): Promise<V1ConfigMap | null> {
    return await itemResponse(this.coreApi.readNamespacedConfigMap(name, namespace))
  }

  async getSecrets(namespace: string): Promise<V1Secret[]> {
    return await listResponse(this.coreApi.listNamespacedSecret(namespace))
  }

  async getSecret(namespace: string, name: string): Promise<V1Secret | null> {
    return await itemResponse(this.coreApi.readNamespacedSecret(name, namespace))
  }

  private decodeSecret(secret: V1Secret): Secret {
    const data = secret.data || {}
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        const decodedValue = Buffer.from(value as string, 'base64')
        return [key, decodedValue.toString('utf8')]
      })
    )
  }

  async getDecodedSecrets(namespace: string): Promise<{[name: string]: Secret}> {
    const secrets = await this.getSecrets(namespace)
    return Object.fromEntries(
      secrets.map(secret => {
        const decodedSecret = this.decodeSecret(secret)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return [secret.metadata!.name, decodedSecret]
      })
    )
  }

  async getDecodedSecret(namespace: string, name: string): Promise<Secret | null> {
    const secret = await this.getSecret(namespace, name)
    if (secret) {
      return this.decodeSecret(secret)
    }
    return null
  }

  /**
   * Watches for changes to a list-able resource; must be cancelled using an AbortController
   */
  async startWatching<T extends KubernetesObject>(
    path: string,
    listQuery: ListPromise<T>,
    signal: AbortSignal,
    {added, updated, deleted, error}: InformerCallbacks<T> = {}
  ): Promise<Informer<T>> {
    signal.addEventListener(
      'abort',
      () => {
        informer.stop()
      },
      {once: true}
    )
    const informer = makeInformer(this.config, path, listQuery)
    if (added) {
      informer.on('add', added)
    }
    if (updated) {
      informer.on('update', updated)
    }
    if (deleted) {
      informer.on('delete', deleted)
    }
    if (error) {
      informer.on('error', error)
    }
    await informer.start()
    return informer
  }

  /**
   * Awaits until a condition is met by a particular pod, deployment or job
   * For example, that a pod has progressed to the "Ready" state
   */
  async condition(namespace: string, resource: 'pod', name: string, condition: string): Promise<V1Pod>
  async condition(namespace: string, resource: 'deployment', name: string, condition: string): Promise<V1Deployment>
  async condition(namespace: string, resource: 'job', name: string, condition: string): Promise<V1Job>
  async condition(
    namespace: string,
    resource: 'pod' | 'deployment' | 'job',
    name: string,
    condition: string
  ): Promise<V1Pod | V1Deployment | V1Job> {
    // eslint-disable-next-line init-declarations
    let path: string
    const fieldSelector = `metadata.name=${name}`
    // eslint-disable-next-line init-declarations
    let listQuery: ListPromise<V1Pod | V1Deployment | V1Job>
    switch (resource) {
      case 'pod':
        path = `/api/v1/namespaces/${namespace}/pods`
        listQuery = () => {
          return this.coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, fieldSelector)
        }
        break
      case 'deployment':
        path = `/apis/apps/v1/namespaces/${namespace}/deployments`
        listQuery = () => {
          return this.appsV1Api.listNamespacedDeployment(namespace, undefined, undefined, undefined, fieldSelector)
        }
        break
      case 'job':
        path = `/apis/batch/v1/namespaces/${namespace}/jobs`
        listQuery = () => {
          return this.batchApi.listNamespacedJob(namespace, undefined, undefined, undefined, fieldSelector)
        }
        break
      default:
        throw new Error(`Implementation error - unkown resource "${resource}" to watch`)
    }
    return new Promise((resolve, reject) => {
      const informerController = new AbortController()
      this.startWatching(path, listQuery, informerController.signal, {
        updated(resource) {
          const conditions = resource.status?.conditions ?? []
          const conditionMet = conditions.some(
            someCondition => someCondition.type === condition && someCondition.status === 'True'
          )
          if (conditionMet) {
            informerController.abort()
            resolve(resource)
          }
        },
        deleted(resource) {
          const event: Event & {resource?: V1Pod | V1Deployment | V1Job} = new Event('deleted')
          event.resource = resource
          informerController.abort()
          reject(event)
        },
      })
    })
  }

  /**
   * Executes a command in a named pod, optionally collecting output
   * TODO: if input is passed to the command's stdin, the output cannot be collected
   */
  async exec(
    namespace: string,
    pod: string,
    command: string[],
    options: ExecOptions & {output: 'stdout'}
  ): Promise<void>
  async exec(
    namespace: string,
    pod: string,
    command: string[],
    options: ExecOptions & {output: 'text'}
  ): Promise<string>
  async exec(
    namespace: string,
    pod: string,
    command: string[],
    options: ExecOptions & {output: 'object'}
  ): Promise<any>
  async exec(
    namespace: string,
    pod: string,
    command: string[],
    options?: ExecOptions
  ): Promise<any>
  async exec(
    namespace: string,
    pod: string,
    command: string[],
    {container, input, output = 'stdout', inputEndDelay = 1000, signal}: ExecOptions = {}
  ): Promise<any | string | void> {
    const executor = new Exec(this.config)

    let tty = false
    let stdin: Readable | null = null
    if (input) {
      tty = true
      stdin = Readable.from({
        async *[Symbol.asyncIterator]() {
          if (typeof input === 'string') {
            yield input
          } else {
            yield* input
          }
          // delay stdin end, otherwise websocket is immediately closed and output is never received
          yield '\x04'  // EOT / CTRL-D
          await setTimeout(inputEndDelay)
        },
      }, {
        encoding: typeof input === 'string' ? 'utf8' : undefined,
        // emitClose: true,
      })
    }

    // eslint-disable-next-line init-declarations
    let stdout: Writable
    if (output === 'object' || output === 'text') {
      stdout = new WritableCollector()
    } else {
      stdout = process.stdout
    }
    const stderr: Writable = process.stderr

    // eslint-disable-next-line no-async-promise-executor
    const status: V1Status | null = await new Promise(async (resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const webSocket = await executor.exec(namespace, pod, container!, command, stdout, stderr, stdin, tty, status => {
        if (status.status !== 'Success') {
          reject(status)
        } else {
          resolve(status)
        }
      })
      if (signal) {
        signal.addEventListener('abort', () => {
          webSocket.close()
          resolve(null)
        })
      }
    })
    if (status === null) {
      return null
    }

    if (output === 'text' || output === 'object') {
      const collector = stdout as WritableCollector
      const buffer = await collector.getBuffer()
      const text = buffer.toString('utf8')
      if (output === 'text') {
        return text
      } else {
        return JSON.parse(text)
      }
    }
  }

  /**
   * Runs a pod and awaits it's "Ready" state
   * TODO: add option to await "Succeeded" phase
   */
  async runPod(
    namespace: string,
    image: string,
    name: string,
    {port = undefined, env = {}, args = []}: RunPodOptions = {}
  ) {
    const container: V1Container = {name, image, imagePullPolicy: 'Always'}
    if (env) {
      container.env = Object.entries(env)
        .map(([name, value]) => {
          return {name, value}
        })
    }
    if (args) {
      container.args = args
    }
    if (port) {
      if (typeof port === 'string') {
        port = parseInt(port, 10)
      }
      container.ports = [{containerPort: port}]
    }
    const podDescription = {
      metadata: {
        name,
        namespace,
        labels: {
          'app.kubernetes.io/name': name,
          'app.kubernetes.io/managed-by': cliPackageName,
        },
      },
      spec: {
        containers: [container],
        restartPolicy: 'Never',
      },
    }
    process.stderr.write(`Running ${name} pod…\n`)
    await this.coreApi.createNamespacedPod(namespace, podDescription)

    process.stderr.write(`Awaiting ${name} pod to be ready…\n`)
    await this.condition(namespace, 'pod', name, 'Ready')
    process.stderr.write(`Pod ${name} is ready\n`)
  }

  /**
   * Forwards a pod's port to a local port
   */
  async portForward(
    namespace: string,
    podName: string,
    localPort: Port,
    podPort: Port,
    signal?: AbortSignal,
    readyCallback?: () => void | Promise<void>,
  ): Promise<void> {
    const localPortNum = typeof localPort === 'string' ? parseInt(localPort, 10) : localPort
    const podPortNum = typeof podPort === 'string' ? parseInt(podPort, 10) : podPort
    process.stderr.write(`Port-forwarding to localhost:${localPortNum}…\n`)

    let server: Server | undefined = undefined

    function terminateServer(): void {
      if (server) {
        process.stderr.write('Port-forwarding ending…\n')
        server.close()
      }
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        terminateServer()
      })
    }

    await trapInterruptSignal(async () => {
      const connection = new PortForward(this.config)
      server = createServer(socket => {
        connection.portForward(namespace, podName, [podPortNum], socket, null, socket)
      })
      server.listen(localPortNum, 'localhost', async () => {
        if (readyCallback) {
          await readyCallback()
        }
      })
      await once(server, 'close')
    }, () => {
      terminateServer()
    })
    process.stderr.write('Port-forwarding ended\n')
  }
}

/**
 * Wrapper for kubernetes client single item response to turn a 404 error into a null object
 */
async function itemResponse<T>(promise: Promise<{body:T}>): Promise<T | null> {
  try {
    const response = await promise
    return response.body
  } catch (e) {
    const httpError = e as HttpError
    if (httpError.statusCode === 404) {
      return null
    }
    throw e
  }
}

/**
 * Wrapper for kubernetes client list response
 */
async function listResponse<T>(promise: Promise<{body: {items: T[]}}>): Promise<T[]> {
  const response = await promise
  return response.body.items || []
}

/**
 * A "Writable" where data written can be collected as a single Buffer
 */
class WritableCollector extends Writable {
  private readonly chunks: any[]
  private readonly finish: Promise<any>

  constructor() {
    const chunks: any[] = []
    super({
      write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        if (encoding && !['binary', 'buffer'].includes(encoding)) {
          callback(new Error('Only binary / Buffer / Uint8Array data can be written to WritableCollector'))
          return
        }
        chunks.push(chunk)
        callback()
      },
    })
    this.finish = once(this, 'finish')
    this.chunks = chunks
  }

  async getBuffer(): Promise<Buffer> {
    await this.finish
    return Buffer.concat(this.chunks)
  }
}
