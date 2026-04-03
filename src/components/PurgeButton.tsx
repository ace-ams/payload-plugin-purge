'use client'

import { Button, toast, useConfig } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

type ErrorResponse = {
  error: string
}

type PurgeResult = {
  deletedCount: number
  message: string
  unusedIds: (number | string)[]
}

type Props = {
  collectionSlug: string
}

export const PurgeButton: React.FC<Props> = ({ collectionSlug }) => {
  const { config } = useConfig()
  const apiRoute = config.routes?.api ?? '/api'

  const [isLoading, setIsLoading] = useState(false)

  const runPurge = useCallback(async () => {
    if (
      !window.confirm(
        `Are you sure you want to purge unused documents from "${collectionSlug}"? This cannot be undone.`,
      )
    ) {
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch(`${apiRoute}/${collectionSlug}/purge`, { method: 'POST' })
      const data = (await res.json()) as ErrorResponse | PurgeResult

      if (!res.ok) {
        toast.error((data as ErrorResponse).error ?? 'Purge request failed.')
        return
      }

      toast.success((data as PurgeResult).message)
    } catch {
      toast.error('An unexpected error occurred while purging.')
    } finally {
      setIsLoading(false)
    }
  }, [collectionSlug, apiRoute])

  if (!collectionSlug) {
    return null
  }

  return (
    <Button buttonStyle="secondary" disabled={isLoading} onClick={runPurge}>
      {isLoading ? 'Purging…' : 'Purge Unused'}
    </Button>
  )
}

export default PurgeButton
