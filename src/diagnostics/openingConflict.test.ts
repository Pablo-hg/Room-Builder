import test from 'node:test'
import assert from 'node:assert/strict'
import { validateOpenings, type OpeningConflict } from '../domain/geometry'
import { DEFAULT_ROOM } from '../domain/constants'

test('diagnostic callback reports only blocking bounds, not overlapping objects', () => {
  const room = structuredClone(DEFAULT_ROOM)
  room.extraDoors = [{ ...room.door, id: 'extra', offset: room.door.offset }]
  const issues: OpeningConflict[] = []
  assert.equal(validateOpenings(room, (conflict) => issues.push(conflict)), null)
  // Comparing with [] using deepEqual narrows the array to never[] in TypeScript.
  assert.equal(issues.length, 0)

  room.extraDoors[0].offset = 30
  assert.match(validateOpenings(room, (conflict) => issues.push(conflict)) ?? '', /fuera/)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].rule, 'opening-bounds')
  assert.deepEqual(issues[0].objectIds, ['extra'])
})
