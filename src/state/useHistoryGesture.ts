import { useCallback, useEffect, useRef } from 'react'
import type { HistoryGestureToken } from './types'
import { useRoomStore } from './useRoomStore'

/** Ownership prevents an old pointer or unmount cleanup from closing a later gesture. */
export function useHistoryGesture(targetId: string) {
  const beginGesture = useRoomStore((state) => state.beginHistoryGesture)
  const commitGesture = useRoomStore((state) => state.commitHistoryGesture)
  const cancelGesture = useRoomStore((state) => state.cancelHistoryGesture)
  const isGestureActive = useRoomStore((state) => state.isHistoryGestureActive)
  const token = useRef<HistoryGestureToken | null>(null)
  const cancel = useCallback(() => {
    if (token.current) cancelGesture(token.current)
    token.current = null
  }, [cancelGesture])
  const begin = useCallback(() => {
    cancel()
    token.current = beginGesture(targetId)
  }, [beginGesture, cancel, targetId])
  const commit = useCallback(() => {
    if (token.current) commitGesture(token.current)
    token.current = null
  }, [commitGesture])
  useEffect(() => cancel, [cancel, targetId])
  const isActive = useCallback(() => token.current !== null && isGestureActive(token.current), [isGestureActive])
  return { begin, commit, cancel, isActive }
}
