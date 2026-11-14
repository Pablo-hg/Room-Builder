import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextOverlappingId } from './overlapFocus'

test('cicla entre objetos superpuestos de delante hacia atrás', () => {
  const stack = ['a', 'b', 'c']
  assert.equal(nextOverlappingId(stack, null), 'a')
  assert.equal(nextOverlappingId(stack, 'a'), 'b')
  assert.equal(nextOverlappingId(stack, 'c'), 'a')
  assert.equal(nextOverlappingId(stack, 'z'), 'a')
})

test('ignora duplicados y no actúa con un solo objeto', () => {
  assert.equal(nextOverlappingId(['a', 'a'], null), null)
  assert.equal(nextOverlappingId(['a', 'b', 'a'], 'a'), 'b')
  assert.equal(nextOverlappingId([], null), null)
})
