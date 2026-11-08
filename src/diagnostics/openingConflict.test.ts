import test from 'node:test'
import assert from 'node:assert/strict'
import { validateOpenings, type OpeningConflict } from '../domain/geometry'
import { DEFAULT_ROOM } from '../domain/constants'

test('diagnostic callback reports the exact blocking pair without changing validation policy', () => {
  const room = structuredClone(DEFAULT_ROOM)
  room.extraDoors = [{ ...room.door, id: 'extra', offset: room.door.offset }]
  const issues: OpeningConflict[] = []
  assert.equal(validateOpenings(room, (conflict) => issues.push(conflict)), validateOpenings(room))
  assert.equal(issues[0].rule, 'opening-gap')
  assert.deepEqual(issues[0].objectIds, ['door', 'extra'])
  assert.equal(issues[0].requiredGap, .15)
})
