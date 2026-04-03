import type { CollectionSlug, Config } from 'payload'

import purgeHandler from './endpoints/purge.js'

export type PayloadPurgeConfig = {
  /**
   * A map of collection slugs to enable the purge feature on.
   * Set a collection's value to `true` to enable, or `false` / omit to skip.
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
        handler: (req) => purgeHandler(req, collectionSlug),
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

    return config
  }
