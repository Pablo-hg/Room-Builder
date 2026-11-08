import { useState } from 'react'
import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, WALL_LABELS, WALL_SIDES } from '../../domain/constants'
import { useRoomStore } from '../../state/useRoomStore'
import { ColorControl, DimensionControl } from './Controls'
import { SelectionInspector } from './SelectionInspector'
import { PackInspector } from './PackInspector'
import { focusedRoom } from '../../domain/roomEditing'
import { DiagnosticExportButton } from './DiagnosticExportButton'

export function SettingsPanel() {
  const state = useRoomStore()
  const cameraRoom = focusedRoom(state)
  const editableRoom = cameraRoom.editable
  const pack = state.structurePacks.find((candidate) => candidate.id === cameraRoom.packId)
  const setSelectedColor = (kind: 'floor' | 'wall', color: string, wall?: typeof WALL_SIDES[number]) => {
    if (!pack) { if (kind === 'floor') state.setFloorColor(color); else if (wall) state.setWallSideColor(wall, color); else state.setWallColor(color); return }
    const token = state.beginHistoryGesture(pack.id)
    pack.surfaces.filter((surface) => surface.kind === kind && (!wall || surface.wall === wall)).forEach((surface) => state.setStructureSurfaceColor(pack.id, surface.id, color))
    state.commitHistoryGesture(token)
  }
  const [roomSectionCollapsed, setRoomSectionCollapsed] = useState(false)
  const [wallColorsCollapsed, setWallColorsCollapsed] = useState(false)
  const [shortcutGuideCollapsed, setShortcutGuideCollapsed] = useState(false)
  const room = useRoomStore((state) => state.room)
  return (
    <aside id="settings-panel" className="side-panel settings-panel" aria-label="Inspector y configuración detallada">
      <div className="side-panel__content settings-panel__content">
        <SelectionInspector />
        <section className="panel-section room-section">
          <span className="eyebrow">Espacio</span>
          <h2 className="room-section__heading">
            <button
              type="button"
              className="room-section__toggle"
              aria-expanded={!roomSectionCollapsed}
              aria-controls="room-section-content"
              onClick={() => setRoomSectionCollapsed((collapsed) => !collapsed)}
            >
              <span>{cameraRoom.name}</span>
              <span className="room-section__chevron" aria-hidden="true" />
            </button>
          </h2>
          <div id="room-section-content" hidden={roomSectionCollapsed}>
            <p className="section-copy">{editableRoom ? 'Habitación enfocada en la cámara. Las dimensiones solo modifican esta habitación.' : 'La habitación enfocada necesita una carpeta con suelo y cuatro paredes alineadas para editar sus dimensiones.'}</p>
            <div className="dimension-visual" aria-hidden="true">
              <span>{cameraRoom.size.depth.toFixed(1)} m</span><div><b>{cameraRoom.size.width.toFixed(1)} m</b><i>⌂</i></div>
            </div>
            <DimensionControl field="width" label="Anchura" />
            <DimensionControl field="depth" label="Profundidad" />
            <DimensionControl field="height" label="Altura" />
            <ColorControl
              label="Suelo"
              value={pack?.surfaces.find((surface) => surface.kind === 'floor')?.color ?? room.floorColor ?? DEFAULT_FLOOR_COLOR}
              onChange={(color) => setSelectedColor('floor', color)}
            />
            <ColorControl
              label="Todas las paredes"
              value={pack?.surfaces.find((surface) => surface.kind === 'wall')?.color ?? room.wallColor ?? DEFAULT_WALL_COLOR}
              onChange={(color) => setSelectedColor('wall', color)}
            />
            <h3 className={`wall-colors-heading${wallColorsCollapsed ? ' wall-colors-heading--collapsed' : ''}`}>
              <button
                type="button"
                className="catalog-family__toggle"
                aria-expanded={!wallColorsCollapsed}
                aria-controls="wall-color-controls"
                aria-label={`${wallColorsCollapsed ? 'Mostrar' : 'Minimizar'} controles de color de las paredes`}
                onClick={() => setWallColorsCollapsed((collapsed) => !collapsed)}
              >
                <i aria-hidden="true" />
                Paredes por separado
              </button>
            </h3>
            <div id="wall-color-controls" hidden={wallColorsCollapsed}>
              {WALL_SIDES.map((wall) => (
                <ColorControl
                  key={wall}
                  label={`Pared ${WALL_LABELS[wall]}`}
                  value={pack?.surfaces.find((surface) => surface.wall === wall)?.color ?? room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR}
                  onChange={(color) => setSelectedColor('wall', color, wall)}
                />
              ))}
            </div>
            {pack && <PackInspector key={pack.id} selectedPack={pack} />}
          </div>
        </section>
        <section className="panel-section shortcut-guide">
          <h3 className="shortcut-guide__heading">
            <button
              type="button"
              className="shortcut-guide__toggle"
              aria-expanded={!shortcutGuideCollapsed}
              aria-controls="shortcut-guide-list"
              onClick={() => setShortcutGuideCollapsed((collapsed) => !collapsed)}
            >
              <span>Atajos de teclado</span>
              <span className="shortcut-guide__chevron" aria-hidden="true" />
            </button>
          </h3>
          <div id="shortcut-guide-list" hidden={shortcutGuideCollapsed}>
            <dl className="shortcut-list">
              <div><dt>Deshacer</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Z</kbd></dd></div>
              <div><dt>Rehacer</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></dd></div>
              <div><dt>Guardar cambios</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>G</kbd></dd></div>
              <div><dt>Copiar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>C</kbd></dd></div>
              <div><dt>Pegar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>V</kbd></dd></div>
              <div><dt>Duplicar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>D</kbd></dd></div>
              <div><dt>Agrupar</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Alt</kbd> + <kbd>G</kbd></dd></div>
              <div><dt>Desagrupar</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Mayús</kbd> + <kbd>G</kbd></dd></div>
              <div><dt>Renombrar</dt><dd><kbd>F2</kbd></dd></div>
              <div><dt>Ordenar en la lista</dt><dd><kbd>Alt</kbd> + <kbd>Mayús</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd></dd></div>
              <div><dt>Crear subcarpeta</dt><dd><kbd>Alt</kbd> + <kbd>Mayús</kbd> + <kbd>N</kbd></dd></div>
              <div><dt>Girar elemento</dt><dd><kbd>R</kbd></dd></div>
              <div><dt>Eliminar elemento</dt><dd><kbd>Supr</kbd> / <kbd>Retroceso</kbd></dd></div>
            </dl>
            <p className="shortcut-guide__hint">Copia, pega y duplica con un elemento seleccionado.</p>
          </div>
        </section>
        <section className="panel-section diagnostic-export-section" aria-label="Diagnóstico local">
          <DiagnosticExportButton />
        </section>
      </div>
    </aside>
  )
}

