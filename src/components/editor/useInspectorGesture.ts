import { useEffect, type FocusEvent, type PointerEvent } from 'react'
import { useHistoryGesture } from '../../state/useHistoryGesture'

export function useInspectorGesture(targetId: string) {
  const gesture = useHistoryGesture(targetId)
  const { cancel } = gesture
  useEffect(() => {
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [cancel])

  return {
    ...gesture,
    events: {
      onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
        const target = event.target
        if ((target instanceof HTMLInputElement && target.type === 'range')
          || (target instanceof Element && target.closest('.rotation-dial'))) gesture.begin()
      },
      onPointerUpCapture: gesture.commit,
      onPointerCancelCapture: gesture.cancel,
      onBlurCapture: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) gesture.commit()
      },
      onLostPointerCapture: gesture.cancel,
    },
  }
}
