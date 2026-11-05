/**
 * Tipado mínimo de jsonstat-toolkit (el paquete no distribuye tipos).
 * Solo se declara la superficie que EUROPIVOT usa: validar la estructura
 * y navegar dimensiones/categorías. El aplanado se hace sobre la vista
 * tipada propia en jsonstatParser.ts.
 */
declare module 'jsonstat-toolkit' {
  export interface JsonStatCategory {
    id: string
    label?: string
  }
  export interface JsonStatDimensionView {
    id: string[]
    label?: string
    Category: (index: number) => JsonStatCategory | null
  }
  export interface JsonStatDatasetView {
    id: string[]
    size: number[]
    label?: string
    Dimension: (dimId: string) => JsonStatDimensionView | null
  }
  export interface JsonStatBundle {
    Dataset: (index: number) => JsonStatDatasetView
  }
  const JSONstat: (input: unknown) => JsonStatBundle
  export default JSONstat
}
