import type { ViewMode } from '../../domain/types'

export const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'isometric', label: 'Isométrica', icon: '◇' },
  { id: 'top', label: 'Plano', icon: '▦' },
  { id: 'front', label: 'Frontal', icon: '▣' },
  { id: 'pov', label: 'POV', icon: '◉' },
  { id: 'free', label: 'Libre', icon: '✥' },
]
