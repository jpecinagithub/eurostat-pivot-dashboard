import { Component, type ReactNode } from 'react'

/**
 * Frontera de error por sección (QA 2026-11-05, criterio P3): un
 * fallo de pintado en una sección (panel, constructor, dashboard)
 * nunca debe dejar la página entera en blanco — el resto de la app
 * (empezando por el buscador) sigue disponible y la sección caída
 * muestra un aviso con salida (recargar).
 */
interface Props {
  label: string
  fallbackText: string
  children: ReactNode
}

interface State {
  failed: boolean
}

export class SafeSection extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // Visible en consola para diagnóstico; la UI no se cae.
    console.error(`EUROPIVOT: sección «${this.props.label}» aislada tras un error:`, error)
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 px-4 py-3 text-sm"
        >
          {this.props.fallbackText}{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
