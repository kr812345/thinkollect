import { useMemo, useRef } from 'react'
import { Gesture } from 'react-native-gesture-handler'

const ACTIVATE_DISTANCE = 30
const SWIPE_DISTANCE = 60
const SWIPE_VELOCITY = 500

/** Pan gesture that fires `onSwipe` on a right-to-left swipe and ignores vertical scrolls. */
export function useSwipeLeft(onSwipe: () => void, enabled = true) {
  const handler = useRef(onSwipe)
  handler.current = onSwipe

  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .runOnJS(true)
        .activeOffsetX([-ACTIVATE_DISTANCE, Number.MAX_SAFE_INTEGER])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          if (e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY) {
            handler.current()
          }
        }),
    [enabled]
  )
}
