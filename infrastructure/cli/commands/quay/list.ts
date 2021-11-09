/* eslint camelcase: "off" */
import fetch from 'node-fetch'

import {appName} from '../../lib/app.js'
import {makeCommand} from '../../lib/command.js'
import {bytes, collect, shortDateTime, shortDigest} from '../../lib/misc.js'
import {printTable} from '../../lib/table.js'

export const {command, description, builder} = makeCommand(
  import.meta.url,
  'List images in Quay.io',
  {
    takesEnvironment: false,
  }
)

export async function handler(): Promise<void> {
  const images = await collect(getImages())
  const rows = images.map(image => {
    return {
      image: image.name,
      created: shortDateTime(image.last_modified),
      digest: shortDigest(image.manifest_digest),
      size: bytes(image.size),
    }
  })
  const columns = [
    {key: 'image', name: 'Image'},
    {key: 'created', name: 'Created'},
    {key: 'digest', name: 'Digest'},
    {key: 'size', name: 'Size'},
  ]
  printTable(rows, columns)
}

type QuayImage = {
  // NB: some keys omitted
  name: string
  docker_image_id: string
  manifest_digest: string
  last_modified: Date
  size: number
}

async function* getImages(): AsyncGenerator<QuayImage, void, void> {
  let page = 1
  let moreResults = false
  do {
    const response = await fetch(
      `https://quay.io/api/v1/repository/hmpps/${appName}/tag/?limit=100&page=${page}&onlyActiveTags=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible)',
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
    )
    const data = await response.json() as {
      // NB: some keys omitted
      has_additional: boolean
      tags: (Omit<QuayImage, 'last_modified'> & {last_modified: string | Date})[]
    } | {message: string}
    if ('message' in data) {
      throw new Error(`Quay.io error: ${data.message}`)
    }
    const images: QuayImage[] = data.tags.map(tag => {
      if (typeof tag.last_modified === 'string') {
        tag.last_modified = new Date(tag.last_modified)
      }
      return tag as QuayImage
    })
    for (const image of images) {
      yield image
    }
    moreResults = data.has_additional
    page += 1
  } while (moreResults)
}
