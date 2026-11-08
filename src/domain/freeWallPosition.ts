export function validateFreeWallPosition(value: unknown): void {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !['x', 'y', 'z', 'yaw'].every((axis) => typeof (value as Record<string, unknown>)[axis] === 'number' && Number.isFinite((value as Record<string, number>)[axis]))) {
    throw new Error('Posición libre de elemento mural inválida.')
  }
}
