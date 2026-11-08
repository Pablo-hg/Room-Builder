import type { ElementFolder } from '../../domain/types'
import { canMoveFolder, folderElementIds, folderSelectionId, orderedSceneIds, ROOT_ROOM_FOLDER, sceneEntryParent } from '../../domain/elementFolders'
import { elementName } from '../../domain/selection'
import { useRoomStore } from '../../state/useRoomStore'
import { FolderIcon } from './ElementIcons'

export function FolderInspector({ folder }: { folder: ElementFolder }) {
  const room = useRoomStore((state) => state.room)
  const furniture = useRoomStore((state) => state.furniture)
  const structurePacks = useRoomStore((state) => state.structurePacks)
  const assignments = useRoomStore((state) => state.elementFolderAssignments)
  const sceneElementOrder = useRoomStore((state) => state.sceneElementOrder)
  const folders = useRoomStore((state) => state.elementFolders)
  const hiddenElementIds = useRoomStore((state) => state.hiddenElementIds)
  const lockedElementIds = useRoomStore((state) => state.lockedElementIds)
  const moveElementFolder = useRoomStore((state) => state.moveElementFolder)
  const reorderSceneElement = useRoomStore((state) => state.reorderSceneElement)
  const deleteElementFolder = useRoomStore((state) => state.deleteElementFolder)
  const toggleElementFolderVisibility = useRoomStore((state) => state.toggleElementFolderVisibility)
  const toggleElementFolderLock = useRoomStore((state) => state.toggleElementFolderLock)
  const elementIds = folderElementIds(assignments, folder.id, folders)
  const siblings = orderedSceneIds({ room, furniture, structurePacks, sceneElementOrder, elementFolders: folders }).filter((id) => sceneEntryParent(id, folders, assignments) === (folder.parentId ?? null))
  const folderId = folderSelectionId(folder.id)
  const folderIndex = siblings.indexOf(folderId)
  const elements = elementIds.map((id) => ({
    id,
    name: elementName({ room, furniture, structurePacks }, id) ?? id,
    hidden: hiddenElementIds.includes(id),
    locked: lockedElementIds.includes(id),
  }))
  const empty = elements.length === 0
  const hasContents = !empty || folders.some((candidate) => candidate.parentId === folder.id)
  const allHidden = !empty && elements.every((element) => element.hidden)
  const allLocked = !empty && elements.every((element) => element.locked)
  const hiddenCount = elements.filter((element) => element.hidden).length
  const lockedCount = elements.filter((element) => element.locked).length
  const visibilityLabel = hiddenCount === 0 ? 'Visibles' : allHidden ? 'Ocultos' : `${hiddenCount} ocultos`
  const lockLabel = lockedCount === 0 ? 'Libres' : allLocked ? 'Bloqueados' : `${lockedCount} bloqueados`

  return (
    <section className="panel-section selection-section selection-section--inspector" aria-label="Inspector de la carpeta">
      <span className="eyebrow">Inspector del grupo</span>
      <div className="selected-heading">
        <span className="folder-inspector__icon"><FolderIcon /></span>
        <div>
          <h2>{folder.name}</h2>
          <p>{elements.length === 1 ? '1 elemento' : `${elements.length} elementos`}</p>
        </div>
      </div>
      <div className="object-actions" aria-label="Orden de la carpeta">
        <button type="button" disabled={folderIndex <= 0} onClick={() => reorderSceneElement(folderId, siblings[folderIndex - 1], 'before')}>Subir</button>
        <button type="button" disabled={folderIndex < 0 || folderIndex >= siblings.length - 1} onClick={() => reorderSceneElement(folderId, siblings[folderIndex + 1], 'after')}>Bajar</button>
      </div>
      <label className="element-name-control">
        <span>Ubicación de la carpeta</span>
        <select value={folder.parentId ?? ''} disabled={folder.id === ROOT_ROOM_FOLDER} onChange={(event) => moveElementFolder(folder.id, event.target.value || null)}>
          <option value="">Nivel principal</option>
          {folders.filter((candidate) => canMoveFolder(folders, folder.id, candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      </label>
      <div className="property-grid" aria-label="Características de la carpeta">
        <span><small>Elementos</small><strong>{elements.length}</strong></span>
        <span><small>Tipo</small><strong>Agrupación</strong></span>
        <span><small>Visibilidad</small><strong>{visibilityLabel}</strong></span>
        <span><small>Bloqueo</small><strong>{lockLabel}</strong></span>
      </div>
      {elements.length > 0
        ? <ul className="folder-inspector__elements" aria-label="Elementos de la carpeta">
          {elements.map((element) => (
            <li key={element.id}>
              <span>{element.name}</span>
              <small>{[element.hidden && 'Oculto', element.locked && 'Bloqueado'].filter(Boolean).join(' · ') || 'Visible'}</small>
            </li>
          ))}
        </ul>
        : <p className="folder-inspector__empty">Esta carpeta no contiene elementos. Muévelos aquí desde el icono de carpeta de cada fila.</p>}
      <div className="object-actions">
        <button type="button" disabled={empty} onClick={() => toggleElementFolderVisibility(folder.id)}>
          {allHidden ? 'Mostrar todo' : 'Ocultar todo'}
        </button>
        <button type="button" disabled={empty} onClick={() => toggleElementFolderLock(folder.id)}>
          {allLocked ? 'Desbloquear todo' : 'Bloquear todo'}
        </button>
        {folder.id !== ROOT_ROOM_FOLDER && hasContents && <button type="button" className="folder-inspector__delete" onClick={() => deleteElementFolder(folder.id, 'ungroup')}>Desagrupar</button>}
        {folder.id !== ROOT_ROOM_FOLDER && <button type="button" className="danger folder-inspector__delete" onClick={() => deleteElementFolder(folder.id)}>
          <span>×</span> Eliminar carpeta
        </button>}
      </div>
      <p className="rotation-hint">Al seleccionar la carpeta ves sus datos, pero sus elementos siguen manteniendo su posición propia.</p>
    </section>
  )
}
