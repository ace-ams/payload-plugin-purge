# Payload Purge

A [Payload CMS](https://payloadcms.com) plugin that adds a **Purge Unused** button to any collection's list view. When triggered, it scans all other collections and globals for references and permanently deletes any documents that are not used anywhere.

## Installation

```sh
pnpm add @ace-ams/payload-purge
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

| Option        | Type                                          | Description                                          |
| ------------- | --------------------------------------------- | ---------------------------------------------------- |
| `collections` | `CollectionSlug[]`                            | Array of collection slugs to enable the purge feature on. |
| `disabled`    | `boolean`                                     | Set to `true` to disable the plugin without removing it. |

## How it works

1. Fetches all documents from the target collection.
2. Scans every other collection and global for any reference to those document IDs.
3. Deletes any document whose ID was not found in any reference.

> **Note:** Only authenticated users can trigger a purge. Unauthenticated requests will receive a `401` response.

---

## Development

1. Clone the repository and run `pnpm install` to install dependencies.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `PAYLOAD_SECRET`.
3. Run `pnpm dev` to start the local Payload dev environment at `http://localhost:3000`.
4. Make changes inside `src/` — the dev project in `dev/` picks them up automatically.
5. Run `pnpm test:int` to run integration tests and `pnpm test:e2e` for end-to-end tests.
6. Run `pnpm build` to compile the plugin to `dist/` before publishing.
