import type { PayloadRequest } from 'payload'

export default async function purgeHandler(
  req: PayloadRequest,
  collectionSlug: string,
): Promise<Response> {
  const { payload } = req

  // 1. Authentication check — only logged-in users may purge
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Fetch all documents in the target collection
    const targetDocs = await payload.find({
      collection: collectionSlug as never,
      depth: 0,
      limit: 0,
      pagination: false,
    })

    const allIds: (number | string)[] = targetDocs.docs.map((doc) => doc.id)

    if (allIds.length === 0) {
      return Response.json({
        deletedCount: 0,
        message: 'No documents found — nothing to purge.',
        unusedIds: [],
      })
    }

    const usedIds = new Set<number | string>()

    // 3. Scan every other collection for references to these IDs
    for (const collection of payload.config.collections) {
      if (collection.slug === collectionSlug) {
        continue
      }

      const items = await payload.find({
        collection: collection.slug as never,
        depth: 0,
        limit: 0,
        pagination: false,
      })

      const serialised = JSON.stringify(items.docs)

      for (const id of allIds) {
        if (serialised.includes(`"${id}"`)) {
          usedIds.add(id)
        }
      }
    }

    // 4. Scan every global for references (globals may not be defined)
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

    // 5. Delete unused documents
    for (const id of unusedIds) {
      await payload.delete({
        id: id as string,
        collection: collectionSlug as never,
      })
    }

    return Response.json({
      deletedCount: unusedIds.length,
      message: `Purged ${unusedIds.length} unused document(s) from "${collectionSlug}". Refresh to see the cleaned list.`,
      unusedIds,
    })
  } catch {
    return Response.json(
      { error: `Failed to purge collection "${collectionSlug}"` },
      { status: 500 },
    )
  }
}
