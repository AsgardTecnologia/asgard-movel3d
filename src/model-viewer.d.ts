import type { ModelViewerElement } from '@google/model-viewer'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type AtributosModelViewer = DetailedHTMLProps<HTMLAttributes<ModelViewerElement>, ModelViewerElement> & {
  [atributo: `${string}-${string}`]: string | boolean | undefined
  src?: string
  poster?: string
  alt?: string
  ar?: boolean
  exposure?: string
  loading?: 'auto' | 'lazy' | 'eager'
  reveal?: 'auto' | 'manual'
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': AtributosModelViewer
    }
  }
}
