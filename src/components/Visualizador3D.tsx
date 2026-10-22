import type { ModelViewerElement } from '@google/model-viewer'
import { useEffect, type ReactNode, type RefObject } from 'react'
import type { Movel } from '../data/moveis'
import { aplicarCor, aplicarMateriais, ativarGavetas } from '../lib/modelo3d'

type Props = {
  movel: Movel
  cor: number
  /** Opção escolhida em `movel.complemento`. */
  complemento?: number
  refViewer: RefObject<ModelViewerElement | null>
  className?: string
  /** Conteúdo exibido por cima do modelo (também aparece durante a RA no Android). */
  children?: ReactNode
}

export function Visualizador3D({ movel, cor, complemento = 0, refViewer, className = '', children }: Props) {
  const modelo = movel.modelo!
  const materiaisComplemento = movel.complemento?.opcoes[complemento]?.materiais

  useEffect(() => {
    import('@google/model-viewer')
  }, [])

  useEffect(() => {
    const mv = refViewer.current
    if (!mv) return
    const aplicar = () => {
      aplicarCor(mv, modelo, movel.cores[cor], cor === 0)
      if (materiaisComplemento) aplicarMateriais(mv, materiaisComplemento)
    }
    if (mv.loaded) aplicar()
    mv.addEventListener('load', aplicar)
    return () => mv.removeEventListener('load', aplicar)
  }, [refViewer, modelo, movel.cores, cor, materiaisComplemento])

  useEffect(() => {
    const mv = refViewer.current
    if (!mv || !modelo.gavetas) return
    return ativarGavetas(mv, modelo.gavetas)
  }, [refViewer, modelo.gavetas])

  return (
    <model-viewer
      ref={refViewer}
      src={modelo.src}
      poster={movel.cores[cor].imagem ?? movel.imagem}
      alt={`Modelo 3D de ${movel.nome}`}
      camera-controls
      touch-action="pan-y"
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="fixed"
      camera-orbit="35deg 75deg auto"
      shadow-intensity="1"
      shadow-softness="0.8"
      exposure="1.05"
      interaction-prompt="auto"
      className={`visualizador-3d block h-full w-full ${className}`}
    >
      <span slot="ar-button" hidden />
      {children}
    </model-viewer>
  )
}
