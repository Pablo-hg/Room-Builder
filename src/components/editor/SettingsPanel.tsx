import { useState } from 'react'
import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, WALL_LABELS, WALL_SIDES } from '../../domain/constants'
import { useRoomStore } from '../../state/useRoomStore'
import { ColorControl, DimensionControl } from './Controls'
import { SelectionInspector } from './SelectionInspector'

export function SettingsPanel() {
  const [wallColorsCollapsed, setWallColorsCollapsed] = useState(false)
  const [shortcutGuideCollapsed, setShortcutGuideCollapsed] = useState(false)
  const room = useRoomStore((state) => state.room)
  const setWallColor = useRoomStore((state) => state.setWallColor)
  const setWallSideColor = useRoomStore((state) => state.setWallSideColor)
  const setFloorColor = useRoomStore((state) => state.setFloorColor)
  return (
    <aside id="settings-panel" className="side-panel settings-panel" aria-label="Inspector y configuración detallada">
      <div className="side-panel__content settings-panel__content">
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
              <div><dt>Copiar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>C</kbd></dd></div>
              <div><dt>Pegar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>V</kbd></dd></div>
              <div><dt>Duplicar elemento</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>D</kbd></dd></div>
              <div><dt>Girar elemento</dt><dd><kbd>R</kbd></dd></div>
              <div><dt>Eliminar elemento</dt><dd><kbd>Supr</kbd> / <kbd>Retroceso</kbd></dd></div>
            </dl>
            <p className="shortcut-guide__hint">Copia, pega y duplica con un elemento seleccionado.</p>
          </div>
        </section>
        <SelectionInspector />
        <section className="panel-section room-section">
          <span className="eyebrow">Espacio</span>
          <h2>Tu habitación</h2>
          <p className="section-copy">Ajusta el tamaño, los colores y las aperturas.</p>
          <div className="dimension-visual" aria-hidden="true">
            <span>{room.depth.toFixed(1)} m</span><div><b>{room.width.toFixed(1)} m</b><i>⌂</i></div>
          </div>
          <DimensionControl field="width" label="Anchura" />
          <DimensionControl field="depth" label="Profundidad" />
          <DimensionControl field="height" label="Altura" />
          <ColorControl
            label="Suelo"
            value={room.floorColor ?? DEFAULT_FLOOR_COLOR}
            onChange={setFloorColor}
          />
          <ColorControl
            label="Todas las paredes"
            value={room.wallColor ?? DEFAULT_WALL_COLOR}
            onChange={setWallColor}
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
                value={room.wallColors?.[wall] ?? room.wallColor ?? DEFAULT_WALL_COLOR}
                onChange={(color) => setWallSideColor(wall, color)}
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}

