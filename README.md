# Payload Purge

A [Payload CMS](https://payloadcms.com) plugin that adds a **Purge Unused** button to any collection's list view. When triggered, it scans all other collections and globals for references and permanently deletes any documents that are not referenced anywhere.

## Installation

```sh
npm i @ace-ams/payload-purge
```

## Setup

Add the plugin to your `payload.config.ts` and pass the slugs of the collections you want to enable purging on:

```ts
import { payloadPurge } from '@ace-ams/payload-purge'
import { buildConfig } from 'payload'

export default buildConfig({
  plugins: [
    payloadPurge({
      collections: ['media'],
    }),
  ],
})
```

That's it. A **Purge Unused** button will appear in the list view toolbar of every enabled collection.

## Options

| Option        | Type                                                   | Default    | Description                                                                              |
| ------------- | ------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| `collections` | `CollectionSlug[]`                                     | —          | Array of collection slugs to enable the purge feature on.                                |
| `disabled`    | `boolean`                                              | `false`    | Set to `true` to disable the plugin without removing it from your config.                |
| `access`      | `(req: PayloadRequest) => boolean \| Promise<boolean>` | allow all  | Optional access control function. Return `false` to deny the request with a `403`.      |
| `beforePurge` | `(args: BeforePurgeArgs) => void \| Promise<void>`     | —          | Hook called before any documents are deleted.                                            |
| `afterPurge`  | `(args: AfterPurgeArgs) => void \| Promise<void>`      | —          | Hook called after all unused documents have been deleted.                                |

### `access`

By default any authenticated user can trigger a purge. Use `access` to restrict it further — for example, to admins only:

```ts
payloadPurge({
  collections: ['media'],
  access: (req) => req.user?.role === 'admin',
})
```

### `beforePurge`

Called after the unused IDs have been identified but before any deletions are performed. Receives the target collection slug and the current request.

```ts
payloadPurge({
  collections: ['media'],
  beforePurge: async ({ collectionSlug, req }) => {
    req.payload.logger.info(`About to purge unused docs from "${collectionSlug}"`)
  },
})
```

### `afterPurge`

Called after all deletions are complete. Receives the collection slug, total deleted count, the request, and the list of deleted IDs.

```ts
payloadPurge({
  collections: ['media'],
  afterPurge: async ({ collectionSlug, deletedCount, unusedIds, req }) => {
    req.payload.logger.info(`Purged ${deletedCount} doc(s) from "${collectionSlug}": ${unusedIds.join(', ')}`)
  },
})
```

## How it works

1. **Authentication** — Only logged-in users may call the purge endpoint. Unauthenticated requests receive a `401`.
2. **Rate limiting** — Each user is limited to one purge every 30 seconds. Subsequent requests within that window receive a `429` with the number of seconds remaining.
3. **Access control** — If an `access` function is provided, it is called next. Returning `false` results in a `403`.
4. **`beforePurge` hook** — Fired before any database work begins.
5. **ID collection** — All document IDs in the target collection are fetched in batches of 100 to avoid loading large collections into memory at once.
6. **Reference scanning** — Every other collection and every global is scanned page-by-page for any occurrence of those IDs. Scanning stops early once all IDs are confirmed as referenced.
7. **Deletion** — Unreferenced documents are deleted one by one, fully respecting the collection's own `access.delete` rules.
8. **`afterPurge` hook** — Fired after all deletions complete.

## Security

- The purge endpoint requires an authenticated session (`401` otherwise).
- A per-user in-memory rate limit of 30 seconds prevents rapid repeated calls.
- Deletions run with `overrideAccess: false` — if a user does not have delete permission on a document according to the collection's own access rules, that document will not be deleted.
- Reference scanning runs with elevated access so that no references are missed due to read restrictions on other collections.
- The plugin logs all purge failures server-side via `payload.logger.error` without leaking internal details to the client.

---

## Development

1. Clone the repository and run `npm install` to install dependencies.
2. Run `npm dev` to start the local Payload dev environment at `http://localhost:3000`.
3. Make changes inside `src/` — the dev project in `dev/` picks them up automatically.
4. Run `npm test:int` to run integration tests and `npm test:e2e` for end-to-end tests.
5. Run `npm build` to compile the plugin to `dist/` before publishing.
