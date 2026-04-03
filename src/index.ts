import type { CollectionSlug, Config, PayloadRequest } from 'payload'

import purgeHandler from './endpoints/purge.js'

export type PayloadPurgeConfig = {
  /**
   * Optional access control function. Called with the current request after
   * authentication. Return `false` to deny the purge with a 403 response.
   * Defaults to allowing any authenticated user.
   */
  access?: (req: PayloadRequest) => boolean | Promise<boolean>
  /**
   * Hook called after all unused documents have been deleted.
   * Receives the collection slug, the number of deleted docs, the request,
   * and the list of deleted IDs.
   */
  afterPurge?: (args: {
    collectionSlug: string
    deletedCount: number
    req: PayloadRequest
    unusedIds: (number | string)[]
  }) => Promise<void> | void
  /**
   * Hook called before any documents are deleted.
   * Receives the target collection slug and the current request.
   */
  beforePurge?: (args: { collectionSlug: string; req: PayloadRequest }) => Promise<void> | void
  /**
   * A list of collection slugs to enable the purge feature on.
   *
   * @example ['media', 'assets']
   */
  collections?: Partial<CollectionSlug[]>
  /**
   * Disable the plugin entirely without removing it from the config.
   */
  disabled?: boolean
}

export const payloadPurge =
  (pluginOptions: PayloadPurgeConfig) =>
  (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config
    }

    if (!config.collections) {
      config.collections = []
    }

    const collections = pluginOptions.collections?.filter((e) => e !== undefined) ?? []

    for (const collectionSlug of collections) {
      const collection = config.collections.find((col) => col.slug === collectionSlug)

      if (!collection) {
        throw new Error(
          `[payload-purge] Collection "${collectionSlug}" not found in config. ` +
            `Make sure the slug is correct and that the collection is registered before the plugin.`,
        )
      }

      // Register the purge endpoint on the collection, passing the slug via closure
      if (!collection.endpoints) {
        collection.endpoints = []
      }

      collection.endpoints.push({
        handler: (req) => purgeHandler(req, collectionSlug, pluginOptions),
        method: 'post',
        path: '/purge',
      })

      // Add the purge button to the collection list view toolbar
      if (!collection.admin) {
        collection.admin = {}
      }

      if (!collection.admin.components) {
        collection.admin.components = {}
      }

      if (!collection.admin.components.listMenuItems) {
        collection.admin.components.listMenuItems = []
      }

      collection.admin.components.listMenuItems.push(`@ace-ams/payload-purge/client#PurgeButton`)
    }

    const previousOnInit = config.onInit
    config.onInit = async (payload) => {
      if (previousOnInit) {
        await previousOnInit(payload)
      }
      payload.logger.info(
        `[payload-purge] Initialized. Purge enabled on collection(s): ${collections.join(', ') || '(none)'}`,
      )
    }

    return config
  }
