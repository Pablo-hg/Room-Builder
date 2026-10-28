import type { RoomState } from './types'

export function selectEditorScene(state: RoomState) {
  return {
    view: state.view,
    isoOrientation: state.isoOrientation,
    wallView: state.wallView,
    freeAzimuth: state.freeAzimuth,
    furniture: state.furniture,
    structurePacks: state.structurePacks,
    room: state.room,
    isoAngle: state.isoAngle,
    freeElevation: state.freeElevation,
    selectElement: state.selectElement,
    setIsoOrbitDragging: state.setIsoOrbitDragging,
    setFreeOrbitDragging: state.setFreeOrbitDragging,
    setIsoAngle: state.setIsoAngle,
    setFreeOrbit: state.setFreeOrbit,
    isIsoOrbitDragging: state.isIsoOrbitDragging,
    isFreeOrbitDragging: state.isFreeOrbitDragging,
    adjustCameraZoom: state.adjustCameraZoom,
    topOrientation: state.topOrientation,
    cameraZoom: state.cameraZoom,
    frontCameraHeight: state.frontCameraHeight,
    povYaw: state.povYaw,
    gridSnap: state.gridSnap,
    gridVisibility: state.gridVisibility,
    lookFromFreeOrbit: state.lookFromFreeOrbit,
    lookFromIsoOrientation: state.lookFromIsoOrientation,
    setView: state.setView,
    lookAtWall: state.lookAtWall,
  }
}

export function selectEditorHeader(state: RoomState) {
  return {
    view: state.view,
    setView: state.setView,
    undoCount: state.undoCount,
    redoCount: state.redoCount,
    undo: state.undo,
    redo: state.redo,
    hasUnsavedChanges: state.hasUnsavedChanges,
    savedDesigns: state.savedDesigns,
    selectedSavedDesignId: state.selectedSavedDesignId,
    saveDesign: state.saveDesign,
    createDesign: state.createDesign,
    renameSavedDesign: state.renameSavedDesign,
    deleteSavedDesign: state.deleteSavedDesign,
    loadDesign: state.loadDesign,
  }
}

export function selectEditorShortcuts(state: RoomState) {
  return {
    copySelected: state.copySelected,
    pasteSelected: state.pasteSelected,
    redo: state.redo,
    removeSelected: state.removeSelected,
    rotateFurniture: state.rotateFurniture,
    undo: state.undo,
  }
}

export const selectActiveDesignName = (state: RoomState) => state.savedDesigns.find((design) => design.id === state.selectedSavedDesignId)?.name ?? 'Room Builder'

export type EditorHeaderState = ReturnType<typeof selectEditorHeader>
