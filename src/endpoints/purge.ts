import type { PayloadRequest } from 'payload'

import type { PayloadPurgeConfig } from '../index.js'

const RATE_LIMIT_MS = 30_000
const lastPurgeTime = new Map<string, number>()

/**
 * Async generator that yields every document in a collection using batched
 * pagination so that very large collections never have to be loaded into
 * memory all at once.
 */
async function* pageDocs(
  payload: PayloadRequest['payload'],
  collection: string,
  pageSize = 100,
): AsyncGenerator<{ id: number | string }> {
  let page = 1

  while (true) {
    const result = await payload.find({
      collection: collection as never,
      depth: 0,
      limit: pageSize,
      overrideAccess: true,
      page,
    })

    for (const doc of result.docs) {
      yield doc as { id: number | string }
    }

    if (!result.hasNextPage) {
      break
    }

    page++
  }
}

export default async function purgeHandler(
  req: PayloadRequest,
  collectionSlug: string,
  pluginOptions: PayloadPurgeConfig,
): Promise<Response> {
  const { payload } = req

  // 1. Authentication check — only logged-in users may purge
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. In-memory rate limiting (per authenticated user)
  const userId = String(req.user.id)
  const now = Date.now()
  const last = lastPurgeTime.get(userId)

  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    const secondsRemaining = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000)
    return Response.json(
      {
        error: `Rate limit exceeded. Please wait ${secondsRemaining} second(s) before purging again.`,
      },
      { status: 429 },
    )
  }

  // 3. Custom access check
  if (pluginOptions.access) {
    const allowed = await pluginOptions.access(req)
    if (!allowed) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Record timestamp now that all pre-flight checks have passed
  lastPurgeTime.set(userId, Date.now())

  // 4. beforePurge hook
  if (pluginOptions.beforePurge) {
    await pluginOptions.beforePurge({ collectionSlug, req })
  }

  try {
    // 5. Fetch all document IDs in the target collection (batched)
    const allIds: (number | string)[] = []

    for await (const doc of pageDocs(payload, collectionSlug)) {
      allIds.push(doc.id)
    }

    if (allIds.length === 0) {
      return Response.json({
        deletedCount: 0,
        message: 'No documents found — nothing to purge.',
        unusedIds: [],
      })
    }

    const usedIds = new Set<number | string>()

    // 6. Scan every other collection for references to these IDs (batched per page)
    for (const collection of payload.config.collections) {
      if (collection.slug === collectionSlug) {
        continue
      }

      // Early-exit: all IDs are already known to be in use
      if (usedIds.size === allIds.length) {
        break
      }

      for await (const doc of pageDocs(payload, collection.slug)) {
        const serialised = JSON.stringify([doc])

        for (const id of allIds) {
          if (serialised.includes(`"${id}"`)) {
            usedIds.add(id)
          }
        }
      }
    }

    // 7. Scan every global for references (globals are not typically large)
    const globals = payload.config.globals ?? []

    for (const global of globals) {
      let item: null | Record<string, unknown> = null

      try {
        item = await payload.findGlobal({
          slug: global.slug,
          depth: 0,
        })
      } catch {
        // Global may not have been initialised yet — skip gracefully
        continue
      }

      if (item) {
        const serialised = JSON.stringify(item)

        for (const id of allIds) {
          if (serialised.includes(`"${id}"`)) {
            usedIds.add(id)
          }
        }
      }
    }

    const unusedIds = allIds.filter((id) => !usedIds.has(id))

    // 8. Delete unused documents (respects collection access control)
    for (const id of unusedIds) {
      await payload.delete({
        id: id as string,
        collection: collectionSlug as never,
        overrideAccess: false,
        req,
      })
    }

    // 9. afterPurge hook
    if (pluginOptions.afterPurge) {
      await pluginOptions.afterPurge({
        collectionSlug,
        deletedCount: unusedIds.length,
        req,
        unusedIds,
      })
    }

    return Response.json({
      deletedCount: unusedIds.length,
      message: `Purged ${unusedIds.length} unused document(s) from "${collectionSlug}". Refresh to see the cleaned list.`,
      unusedIds,
    })
  } catch (err) {
    payload.logger.error({ err }, '[payload-purge] Purge failed')
    return Response.json(
      { error: `Failed to purge collection "${collectionSlug}"` },
      { status: 500 },
    )
  }
}
