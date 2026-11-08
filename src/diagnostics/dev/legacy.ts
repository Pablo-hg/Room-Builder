export interface LegacyEntry { line: number; description: string; session: string; localTimestamp: string }
/** Historical text is displayed only locally; missing semantics are never invented. */
export function parseLegacy(text: string): LegacyEntry[] {
  if (new TextEncoder().encode(text).length > 8 * 1024 * 1024) throw new Error('El histórico supera 8 MB.')
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    const match = /^\[([^\]]+)\] \[([^\]]+)\] (.*)$/.exec(line)
    if (!match) throw new Error(`Línea histórica no reconocida: ${index + 1}.`)
    return { line: index + 1, localTimestamp: match[1], session: match[2], description: match[3] }
  })
}
