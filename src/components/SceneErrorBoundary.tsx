import { Component, type ReactNode } from 'react'

/** Keep the editor and its local-save controls available if a WebGL canvas fails. */
type Props = { children: ReactNode; compact?: boolean; onRetry?: () => void; exporting?: boolean; onExportUnavailable?: () => void }

export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch() {
    if (this.props.exporting) this.props.onExportUnavailable?.()
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && this.props.exporting && !previous.exporting) this.props.onExportUnavailable?.()
  }

  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.compact) return null
    return <div className="scene-error" role="alert">
      <strong>No se puede mostrar la escena 3D.</strong>
      <p>Comprueba que WebGL y la aceleración gráfica estén disponibles en tu navegador. Puedes guardar el diseño o exportarlo como JSON antes de volver a intentarlo.</p>
      <button type="button" className="secondary-button" onClick={() => { this.setState({ failed: false }); this.props.onRetry?.() }}>Intentar mostrar la escena de nuevo</button>
    </div>
  }
}
