import { useState } from 'react'
import { WALL_LABELS } from '../../domain/constants'
import { FURNITURE_CATALOG, FURNITURE_FAMILIES, FURNITURE_PRESETS, isWallPictureKind, OPENING_CATALOG } from '../../domain/objectCatalog'
import type { FurnitureKind } from '../../domain/types'
import { FurnitureIcon, StructurePackIcon, StructureSurfaceIcon } from '../iconCatalog'
import { useRoomStore } from '../../state/useRoomStore'
import { OpeningSwatch } from './Controls'
import { planRoomCreation } from '../../domain/roomCreation'

// Catálogo: estado de las familias y acciones de alta, independiente del árbol
// de escena para que la jerarquía/selección no controle el estado de expansión.
export function ObjectCatalogSection() {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [catalogCollapsed, setCatalogCollapsed] = useState(false)
  const [choosingRoomPosition, setChoosingRoomPosition] = useState(false)
  const addFurniture = useRoomStore((state) => state.addFurniture)
  const addWindow = useRoomStore((state) => state.addWindow)
  const addStructureDoor = useRoomStore((state) => state.addStructureDoor)
  const addStructurePack = useRoomStore((state) => state.addStructurePack)
  const addStructureObject = useRoomStore((state) => state.addStructureObject)
  const room = useRoomStore((state) => state.room)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const selectedId = useRoomStore((state) => state.selectedId)
  const activeRoomId = useRoomStore((state) => state.activeRoomId)
  const elementFolderAssignments = useRoomStore((state) => state.elementFolderAssignments)
  const creationState = { room, structurePacks, selectedId, activeRoomId, elementFolderAssignments }
  const toggleCategory = (category: string) => {
    setCollapsedCategories((current) => ({ ...current, [category]: !current[category] }))
  }

  return (
        <section className="panel-section" data-tour="design">
        <span className="eyebrow">Diseño</span>
        <div className="catalog-heading">
          <div>
            <h2>Construye y amuebla</h2>
            {!catalogCollapsed && <p className="section-copy">Ajusta primero las medidas a la derecha, añade aperturas y después elige tus muebles. Puedes hacerlo en cualquier orden.</p>}
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
          <section className={`catalog-family catalog-group${collapsedCategories.catalog ? ' catalog-family--collapsed' : ''}`} aria-labelledby="catalog-items">
            <h3>
              <button
                id="catalog-items"
                type="button"
                className="catalog-family__toggle catalog-items__toggle"
                aria-expanded={!collapsedCategories.catalog}
                aria-controls="catalog-items-list"
                onClick={() => toggleCategory('catalog')}
              >
                <span>Catálogo</span><i aria-hidden="true" />
              </button>
            </h3>
            {!collapsedCategories.catalog && <div className="catalog-group__categories" id="catalog-items-list">
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
              <button type="button" className="catalog-card" aria-expanded={choosingRoomPosition} onClick={() => setChoosingRoomPosition((open) => !open)}>
                <StructurePackIcon />
                <span>Nueva habitación vacía</span><small>＋ Elegir ubicación</small>
              </button>
              {choosingRoomPosition && <div className="room-position-choices" aria-label="Ubicación de la nueva habitación">
                <strong>¿Dónde crearla?</strong>
                {([['up', 'Encima'], ['down', 'Debajo'], ['north', `Pared ${WALL_LABELS.north}`], ['east', `Pared ${WALL_LABELS.east}`], ['south', `Pared ${WALL_LABELS.south}`], ['west', `Pared ${WALL_LABELS.west}`]] as const).map(([direction, label]) => {
                  const occupied = planRoomCreation(creationState, direction).occupied
                  return <button type="button" key={direction} disabled={occupied} title={occupied ? 'Otra habitación ya ocupa ese espacio.' : undefined} onClick={() => { addStructurePack(direction); setChoosingRoomPosition(false) }}>{label}{occupied && <small> · Ocupado</small>}</button>
                })}
              </div>}
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
              <button type="button" className="catalog-card" onClick={addStructureDoor}>
                <OpeningSwatch kind="door" /><span>Puerta</span><small>＋ Añadir</small>
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
                    data-tour={family.id === FURNITURE_FAMILIES[0].id ? 'furniture' : undefined}
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
        </div>}
        </section>
  )
}
