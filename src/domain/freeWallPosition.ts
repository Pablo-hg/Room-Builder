export function validateFreeWallPosition(value: unknown): void {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !['x', 'y', 'z', 'yaw'].every((axis) => typeof (value as Record<string, unknown>)[axis] === 'number' && Number.isFinite((value as Record<string, number>)[axis]))) {
    throw new Error('Posición libre de elemento mural inválida.')
  }
}

export function validateWallPosition(value: unknown): void {
  validateFreeWallPosition(value)
  if (value === undefined) return
  const position = value as Record<string, unknown>
  if (['x', 'y', 'z', 'yaw'].some((axis) => Math.abs(position[axis] as number) > 10_000)
    || position.supportId !== undefined && (typeof position.supportId !== 'string' || !position.supportId || position.supportId.length > 500)
    || position.depth !== undefined && (typeof position.depth !== 'number' || !Number.isFinite(position.depth) || position.depth <= 0 || position.depth > 100)) {
    throw new Error('Anclaje a paredes conectadas inválido.')
  }
}
