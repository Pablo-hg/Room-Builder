import { useState } from 'react'
import { WALL_LABELS } from '../../domain/constants'
import { visibleWallsForView } from './viewHelpers'
import { FURNITURE_CATALOG, FURNITURE_FAMILIES, FURNITURE_PRESETS, isWallPictureKind, isWallPictureShape, isWallMirrorShape, OPENING_CATALOG, openingKindForShape } from '../../domain/objectCatalog'
import type { FurnitureKind } from '../../domain/types'
import { FurnitureIcon, StructurePackIcon, StructureSurfaceIcon } from '../iconCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import { structureSurfaceElementId } from '../../domain/elementIds'
import { OpeningSwatch } from './Controls'

export function ObjectsPanel() {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [catalogCollapsed, setCatalogCollapsed] = useState(false)
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const selectedId = useRoomStore((state) => state.selectedId)
  const view = useRoomStore((state) => state.view)
  const isoOrientation = useRoomStore((state) => state.isoOrientation)
  const freeAzimuth = useRoomStore((state) => state.freeAzimuth)
  const wallView = useRoomStore((state) => state.wallView)
  const gridVisibility = useRoomStore((state) => state.gridVisibility)
  const addFurniture = useRoomStore((state) => state.addFurniture)
  const addWindow = useRoomStore((state) => state.addWindow)
  const addStructurePack = useRoomStore((state) => state.addStructurePack)
  const addStructureObject = useRoomStore((state) => state.addStructureObject)
  const selectElement = useRoomStore((state) => state.selectElement)
  const toggleGridVisibility = useRoomStore((state) => state.toggleGridVisibility)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const toggleElementVisibility = useRoomStore((state) => state.toggleElementVisibility)
  const sceneElements = [
    { id: 'door', name: 'Puerta', kind: 'Apertura' },
    ...room.windows.map((window, index) => {
      const name = OPENING_CATALOG[openingKindForShape(window.shape)].name
      const family = window.shape === 'wallShelf' ? 'Almacenaje' : isWallPictureShape(window.shape) || isWallMirrorShape(window.shape) || window.shape === 'wallSconce' ? 'Decoración' : 'Apertura'
      return { id: window.id, name: `${name} ${index + 1}`, kind: `${family} · pared ${WALL_LABELS[window.wall]}` }
    }),
    ...furniture.map((item) => ({ id: item.id, name: item.name, kind: FURNITURE_FAMILIES.find((family) => family.id === FURNITURE_CATALOG[item.kind].family)?.label ?? 'Mueble' })),
    ...structurePacks.flatMap((pack) => [
      { id: pack.id, name: pack.name, kind: 'Pack de construcción' },
      ...pack.surfaces.map((surface) => ({
        id: structureSurfaceElementId(pack.id, surface.id),
        name: `${pack.name} · ${surface.name}`,
        kind: 'Superficie de construcción',
      })),
    ]),
  ]
  const visibleGridWalls = visibleWallsForView(view, isoOrientation, wallView, freeAzimuth)
  const gridControls = [
    { id: 'floor' as const, label: 'Suelo' },
    ...visibleGridWalls.map((wall) => ({ id: wall, label: `Pared ${WALL_LABELS[wall]}` })),
  ]
  const toggleCategory = (category: string) => {
    setCollapsedCategories((current) => ({ ...current, [category]: !current[category] }))
  }

  return (
    <aside id="objects-panel" className="side-panel objects-panel" aria-label="Catálogo de objetos">
      <div className="side-panel__content objects-panel__content">
        <section className="panel-section">
        <span className="eyebrow">Objetos</span>
        <div className="catalog-heading">
          <div>
            <h2>Pequeño catálogo</h2>
            {!catalogCollapsed && <p className="section-copy">Añade muebles, aperturas y decoración mural, o selecciona la puerta existente.</p>}
          </div>
          <button
            type="button"
            className="catalog-family__toggle catalog-toggle-all"
            aria-expanded={!catalogCollapsed}
            aria-controls="catalog-families"
            aria-label={catalogCollapsed ? 'Mostrar catálogo completo' : 'Minimizar catálogo completo'}
            onClick={() => setCatalogCollapsed((collapsed) => !collapsed)}
          >
            <i aria-hidden="true" />
          </button>
        </div>
        {!catalogCollapsed && <div className="catalog-families" id="catalog-families">
          <section className={`catalog-family ${collapsedCategories.structure ? 'catalog-family--collapsed' : ''}`} aria-labelledby="catalog-structure">
            <h3>
              <button
                id="catalog-structure"
                type="button"
                className="catalog-family__toggle"
                aria-expanded={!collapsedCategories.structure}
                aria-controls="catalog-grid-structure"
                onClick={() => toggleCategory('structure')}
              >
                <span>Construcción</span><i aria-hidden="true" />
              </button>
            </h3>
            {!collapsedCategories.structure && <div className="catalog-grid" id="catalog-grid-structure">
              <button type="button" className="catalog-card" onClick={addStructurePack}>
                <StructurePackIcon />
                <span>Nuevo piso vacío</span><small>＋ Pack apilado</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addStructureObject('floor')}>
                <StructureSurfaceIcon kind="floor" />
                <span>Suelo</span><small>＋ Objeto independiente</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addStructureObject('wall')}>
                <StructureSurfaceIcon kind="wall" />
                <span>Pared</span><small>＋ Objeto independiente</small>
              </button>
            </div>}
          </section>
          <section className={`catalog-family ${collapsedCategories.openings ? 'catalog-family--collapsed' : ''}`} aria-labelledby="catalog-openings">
            <h3>
              <button
                id="catalog-openings"
                type="button"
                className="catalog-family__toggle"
                aria-expanded={!collapsedCategories.openings}
                aria-controls="catalog-grid-openings"
                onClick={() => toggleCategory('openings')}
              >
                <span>Aperturas</span><i aria-hidden="true" />
              </button>
            </h3>
            {!collapsedCategories.openings && <div className="catalog-grid" id="catalog-grid-openings">
              <button type="button" className={`catalog-card ${selectedId === 'door' ? 'active' : ''}`} onClick={() => selectElement('door')} aria-pressed={selectedId === 'door'}>
                <OpeningSwatch kind="door" />
                <span>{OPENING_CATALOG.door.name}</span><small>Seleccionar</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addWindow('rectangular')}>
                <OpeningSwatch kind="window" />
                <span>{OPENING_CATALOG.window.name}</span><small>＋ Añadir</small>
              </button>
              <button type="button" className="catalog-card" onClick={() => addWindow('circular')}>
                <OpeningSwatch kind="circularWindow" />
                <span>{OPENING_CATALOG.circularWindow.name}</span><small>＋ Añadir</small>
              </button>
            </div>}
          </section>
          {FURNITURE_FAMILIES.map((family) => {
            const kinds = (Object.keys(FURNITURE_CATALOG) as FurnitureKind[]).filter((kind) => FURNITURE_CATALOG[kind].family === family.id)
            return (
              <section className={`catalog-family ${collapsedCategories[family.id] ? 'catalog-family--collapsed' : ''}`} key={family.id} aria-labelledby={`catalog-${family.id}`}>
                <h3>
                  <button
                    id={`catalog-${family.id}`}
                    type="button"
                    className="catalog-family__toggle"
                    aria-expanded={!collapsedCategories[family.id]}
                    aria-controls={`catalog-grid-${family.id}`}
                    onClick={() => toggleCategory(family.id)}
                  >
                    <span>{family.label}</span><i aria-hidden="true" />
                  </button>
                </h3>
                {!collapsedCategories[family.id] && <div className="catalog-grid" id={`catalog-grid-${family.id}`}>
                  {kinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className="catalog-card"
                      onClick={() => {
                        if (isWallPictureKind(kind)) addWindow(kind)
                        else addFurniture(kind)
                      }}
                    >
                      <FurnitureIcon kind={kind} />
                      <span>{FURNITURE_PRESETS[kind].name}</span><small>＋ Añadir</small>
                    </button>
                  ))}
                  {family.id === 'wallDecor' && (
                    <>
                      <button type="button" className="catalog-card" onClick={() => addWindow('wallSconce')}>
                        <OpeningSwatch kind="wallSconce" />
                        <span>{OPENING_CATALOG.wallSconce.name}</span><small>＋ Añadir</small>
                      </button>
                      <button type="button" className="catalog-card" onClick={() => addWindow('mirrorRectangular')}>
                        <OpeningSwatch kind="mirrorRectangular" />
                        <span>{OPENING_CATALOG.mirrorRectangular.name}</span><small>＋ Añadir</small>
                      </button>
                      <button type="button" className="catalog-card" onClick={() => addWindow('mirrorCircular')}>
                        <OpeningSwatch kind="mirrorCircular" />
                        <span>{OPENING_CATALOG.mirrorCircular.name}</span><small>＋ Añadir</small>
                      </button>
                    </>
                  )}
                  {family.id === 'storage' && (
                    <button type="button" className="catalog-card" onClick={() => addWindow('wallShelf')}>
                      <OpeningSwatch kind="wallShelf" />
                      <span>{OPENING_CATALOG.wallShelf.name}</span><small>＋ Añadir</small>
                    </button>
                  )}
                </div>}
              </section>
            )
          })}
        </div>}
        </section>
        <section className="panel-section elements-section" aria-labelledby="elements-heading">
        <span className="eyebrow">Escena</span>
        <h2 id="elements-heading">Elementos en la habitación</h2>
        <p className="section-copy">Activa o desactiva cada elemento sin eliminarlo.</p>
        <div className="element-list">
          {sceneElements.map((element) => (
            <div className={`element-row ${selectedId === element.id ? 'selected' : ''}`} key={element.id}>
              <label className="element-visibility" title={`Mostrar u ocultar ${element.name}`}>
                <input
                  type="checkbox"
                  checked={!hiddenElementIds.includes(element.id)}
                  onChange={() => toggleElementVisibility(element.id)}
                  aria-label={`Mostrar ${element.name}`}
                />
                <span className="element-check" aria-hidden="true">✓</span>
              </label>
              <button type="button" className="element-select" onClick={() => selectElement(element.id)} aria-pressed={selectedId === element.id}>
                <strong>{element.name}</strong><small>{element.kind}</small>
              </button>
            </div>
          ))}
        </div>
        </section>
        <section className="panel-section grid-section" aria-labelledby="grid-heading">
        <div className="grid-section__heading">
          <span className="grid-icon" aria-hidden="true">▦</span>
          <span><strong id="grid-heading">Cuadrículas visibles</strong><small>Cuadrados de 25 cm</small></span>
        </div>
        <div className="grid-visibility-list">
          {gridControls.map((surface) => (
            <div className="grid-visibility-row" key={surface.id}>
              <span>{surface.label}</span>
              <button
                type="button"
                className={`switch ${gridVisibility[surface.id] ? 'on' : ''}`}
                role="switch"
                aria-checked={gridVisibility[surface.id]}
                aria-label={`Mostrar cuadrícula de ${surface.label.toLowerCase()}`}
                onClick={() => toggleGridVisibility(surface.id)}
              ><span /></button>
            </div>
          ))}
        </div>
        <small className="grid-snap-note">El ajuste de movimiento a 12,5 cm se mantiene activo.</small>
        </section>
      </div>
    </aside>
  )
}

