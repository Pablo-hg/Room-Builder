type FrontTarget = { view: string; wallView: string | null; activeRoomId: string | null; roomX: number; roomY: number; roomZ: number }

export function shouldOrbitFront(previous: FrontTarget, next: FrontTarget) {
  return previous.view === 'front' && next.view === 'front'
    && previous.wallView !== next.wallView
    && previous.activeRoomId === next.activeRoomId
    && previous.roomX === next.roomX && previous.roomY === next.roomY && previous.roomZ === next.roomZ
}
