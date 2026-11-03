import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_GRID_VISIBILITY } from './designV1'
import {
  adjacentRoomPairs,
  assertValidProject,
  projectStructureFingerprint,
  roomsShareWall,
  sharedWallBetween,
  staleLayoutIds,
  validateProject,
  wallLength,
  wallSideForRoom,
  type ProjectV2,
} from './projectV2'

export function twoRoomProject(): ProjectV2 {
  const floorId = 'floor-1'
  const roomA = {
    id: 'room-a',
    name: 'Salón',
    floorId,
    boundary: { x: -3, z: 0, width: 6, depth: 5 },
    height: 2.7,
    wallColor: '#f5eadb',
    floorColor: '#dcc3a3',
  }
  const roomB = {
    id: 'room-b',
    name: 'Dormitorio',
    floorId,
    boundary: { x: 3, z: 0, width: 6, depth: 5 },
    height: 2.7,
    wallColor: '#f5eadb',
    floorColor: '#dcc3a3',
  }
  return {
    schemaVersion: 2,
    id: 'project-two-rooms',
    name: 'Dos habitaciones',
    units: 'meters',
    structureRevision: 0,
    floors: [{ id: floorId, name: 'Planta 0', elevation: 0, roomIds: ['room-a', 'room-b'] }],
    rooms: [roomA, roomB],
    walls: [
      { id: 'wall-shared', name: 'Medianera', start: { x: 0, z: -2.5 }, end: { x: 0, z: 2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-a', 'room-b'] },
      { id: 'wall-a-north', name: 'A norte', start: { x: -6, z: -2.5 }, end: { x: 0, z: -2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-a'] },
      { id: 'wall-a-south', name: 'A sur', start: { x: -6, z: 2.5 }, end: { x: 0, z: 2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-a'] },
      { id: 'wall-a-west', name: 'A oeste', start: { x: -6, z: -2.5 }, end: { x: -6, z: 2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-a'] },
      { id: 'wall-b-north', name: 'B norte', start: { x: 0, z: -2.5 }, end: { x: 6, z: -2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-b'] },
      { id: 'wall-b-south', name: 'B sur', start: { x: 6, z: 2.5 }, end: { x: 0, z: 2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-b'] },
      { id: 'wall-b-east', name: 'B este', start: { x: 6, z: -2.5 }, end: { x: 6, z: 2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-b'] },
    ],
    openings: [
      { id: 'door-a', wallId: 'wall-a-south', kind: 'door', offset: 0, width: 1, height: 2.1, bottom: 0, color: '#ac704b', rotation: 0 },
      { id: 'window-shared', wallId: 'wall-shared', kind: 'window', shape: 'rectangular', offset: 0, width: 1, height: 0.8, bottom: 1, color: '#c88f58', rotation: 0 },
    ],
    furnitureDefinitions: [],
    layouts: [{ id: 'layout-original', name: 'Original', kind: 'original', structureRevision: 0, furniture: [] }],
    activeLayoutId: 'layout-original',
    preferences: {
      gridSnap: true,
      gridVisibility: { ...DEFAULT_GRID_VISIBILITY },
      hiddenElementIds: [],
      lockedElementIds: [],
      elementFolders: [],
      elementFolderAssignments: {},
      sceneElementOrder: [],
    },
    metadata: { createdAt: '2026-11-03T10:00:00.000Z', updatedAt: '2026-11-03T10:00:00.000Z', source: 'new' },
  }
}

test('valida dos habitaciones con una única pared compartida coherente', () => {
  const project = twoRoomProject()
  assert.deepEqual(validateProject(project), [])
  assert.doesNotThrow(() => assertValidProject(project))
  assert.equal(wallLength(project.walls[0]), 5)

  const shared = sharedWallBetween(project, 'room-a', 'room-b')
  assert.equal(shared?.id, 'wall-shared')
  assert.equal(roomsShareWall(project, 'room-a', 'room-b'), true)
  assert.deepEqual(adjacentRoomPairs(project), [['room-a', 'room-b']])
  assert.equal(wallSideForRoom(shared!, project.rooms[0]), 'east')
  assert.equal(wallSideForRoom(shared!, project.rooms[1]), 'west')
  assert.deepEqual(project.walls.filter((wall) => wall.roomIds.length === 2).map((wall) => wall.id), ['wall-shared'])
})

test('exige exactamente una distribución Original', () => {
  const withoutOriginal = structuredClone(twoRoomProject())
  withoutOriginal.layouts = [{ ...withoutOriginal.layouts[0], kind: 'alternative' as const }]
  assert.ok(validateProject(withoutOriginal).some((issue) => issue.code === 'missing-original-layout'))
})

test('detecta paredes compartidas duplicadas y paredes fuera del borde', () => {
  const duplicate = structuredClone(twoRoomProject())
  duplicate.walls.push({ ...duplicate.walls[0], id: 'wall-shared-duplicate' })
  assert.ok(validateProject(duplicate).some((issue) => issue.code === 'duplicate-shared-wall'))

  const outside = structuredClone(twoRoomProject())
  outside.walls.push({ id: 'wall-inside', name: 'Interior', start: { x: -3, z: 0 }, end: { x: -3, z: 1 }, height: 2.7, thickness: 0.125, roomIds: ['room-a'] })
  assert.ok(validateProject(outside).some((issue) => issue.code === 'wall-not-on-room-boundary'))

  // Diagonal con ambos extremos en el perímetro: cruza la habitación.
  const diagonal = structuredClone(twoRoomProject())
  diagonal.walls.push({ id: 'wall-diagonal', name: 'Diagonal', start: { x: -6, z: -2.5 }, end: { x: 0, z: 2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-a'] })
  assert.ok(validateProject(diagonal).some((issue) => issue.code === 'wall-not-along-room-side'))

  // Un tramo alineado con un lado, aunque no lo cubra entero, sigue siendo válido.
  const partial = structuredClone(twoRoomProject())
  partial.walls.push({ id: 'wall-partial', name: 'Tramo', start: { x: -3, z: -2.5 }, end: { x: 0, z: -2.5 }, height: 2.7, thickness: 0.125, roomIds: ['room-a'] })
  assert.ok(!validateProject(partial).some((issue) => issue.code === 'wall-not-along-room-side'))

  // La misma habitación repetida no constituye una pared compartida.
  const repeated = structuredClone(twoRoomProject())
  repeated.walls[3].roomIds = ['room-a', 'room-a']
  assert.ok(validateProject(repeated).some((issue) => issue.code === 'invalid-wall' && issue.message.includes('repetir')))

  // Una medianera entre habitaciones de plantas distintas no es coherente.
  const crossFloor = structuredClone(twoRoomProject())
  crossFloor.rooms[1].floorId = 'floor-2'
  crossFloor.floors.push({ id: 'floor-2', name: 'Planta 1', elevation: 3, roomIds: ['room-b'] })
  assert.ok(validateProject(crossFloor).some((issue) => issue.code === 'invalid-wall' && issue.message.includes('misma planta')))
})

test('detecta referencias, duplicados y aberturas que no caben en su pared', () => {
  const dangling = structuredClone(twoRoomProject())
  dangling.rooms[0].floorId = 'floor-missing'
  assert.ok(validateProject(dangling).some((issue) => issue.code === 'dangling-reference'))

  const duplicateRoom = structuredClone(twoRoomProject())
  duplicateRoom.rooms[1].id = duplicateRoom.rooms[0].id
  assert.ok(validateProject(duplicateRoom).some((issue) => issue.code === 'duplicate-id'))

  const outsideOpening = structuredClone(twoRoomProject())
  outsideOpening.openings.push({ id: 'big-window', wallId: 'wall-shared', kind: 'window', shape: 'rectangular', offset: 0, width: 10, height: 0.8, bottom: 1, color: '#c88f58' })
  assert.ok(validateProject(outsideOpening).some((issue) => issue.code === 'opening-outside-wall'))

  const duplicateFurniture = structuredClone(twoRoomProject())
  const item = { id: 'chair', roomId: 'room-a', kind: 'chair' as const, name: 'Silla', x: 0, y: 0, z: 0, rotation: 0, width: 0.5, depth: 0.5, height: 0.85, color: '#bd8b5f' }
  duplicateFurniture.layouts[0].furniture = [item, { ...item }]
  assert.ok(validateProject(duplicateFurniture).some((issue) => issue.code === 'duplicate-id'))

  // RB-026: dos aberturas que se pisan en tramo y altura no pueden coexistir en la misma pared.
  const overlapping = structuredClone(twoRoomProject())
  overlapping.openings.push({ id: 'door-b', wallId: 'wall-shared', kind: 'door', offset: 0.5, width: 1.2, height: 2.1, bottom: 0, color: '#ac704b', rotation: 0 })
  assert.ok(validateProject(overlapping).some((issue) => issue.code === 'opening-overlap'))

  // Solo compartir tramo, con alturas separadas, no es solape (ventana sobre suelo común).
  const stacked = structuredClone(twoRoomProject())
  stacked.openings.push({ id: 'window-high', wallId: 'wall-shared', kind: 'window', shape: 'rectangular', offset: 2, width: 1, height: 0.8, bottom: 1.9, color: '#c88f58' })
  assert.ok(!validateProject(stacked).some((issue) => issue.code === 'opening-overlap'))

  const missingActive = structuredClone(twoRoomProject())
  missingActive.activeLayoutId = 'layout-missing'
  assert.ok(validateProject(missingActive).some((issue) => issue.code === 'active-layout-missing'))

  const twoOriginals = structuredClone(twoRoomProject())
  twoOriginals.layouts.push({ ...twoOriginals.layouts[0], id: 'layout-original-2' })
  assert.ok(validateProject(twoOriginals).some((issue) => issue.code === 'multiple-original-layouts'))
})

test('la huella estructural cambia con muros y aberturas, no con el mobiliario', () => {
  const project = twoRoomProject()
  const base = projectStructureFingerprint(project)
  const furniture = structuredClone(project)
  furniture.layouts[0].furniture.push({ id: 'chair', roomId: 'room-a', kind: 'chair', name: 'Silla', x: 0, y: 0, z: 0, rotation: 0, width: 0.5, depth: 0.5, height: 0.85, color: '#bd8b5f' })
  assert.equal(projectStructureFingerprint(furniture), base)

  const wallChange = structuredClone(project)
  wallChange.walls[0].thickness += 0.1
  assert.notEqual(projectStructureFingerprint(wallChange), base)

  const openingChange = structuredClone(project)
  openingChange.openings[1].width = 1.2
  assert.notEqual(projectStructureFingerprint(openingChange), base)
})

test('las variantes quedan obsoletas al revisar la estructura hasta confirmarlas', () => {
  const project = twoRoomProject()
  assert.deepEqual(staleLayoutIds(project), [])
  const revised = { ...project, structureRevision: 1 }
  assert.deepEqual(staleLayoutIds(revised), ['layout-original'])
})
