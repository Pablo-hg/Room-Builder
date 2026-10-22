export function sunPosition(azimuth: number, elevation: number, distance = 12): [number, number, number] {
  const azimuthRadians = azimuth * Math.PI / 180
  const elevationRadians = elevation * Math.PI / 180
  const horizontalDistance = Math.cos(elevationRadians) * distance
  return [
    Math.sin(azimuthRadians) * horizontalDistance,
    Math.sin(elevationRadians) * distance,
    -Math.cos(azimuthRadians) * horizontalDistance,
  ]
}
