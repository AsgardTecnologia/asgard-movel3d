import { useEffect, useState } from 'react'

export type Rota =
  | { pagina: 'inicio'; secao?: string }
  | { pagina: 'movel'; slug: string }
  /** `pronto`: abre um ambiente pronto. `foto`: só a cena, em tela cheia, para gerar a foto do card. */
  | { pagina: 'ambiente'; pronto?: string; foto?: boolean }

const lerRota = (): Rota => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [primeiro, segundo, terceiro] = hash.split('/')
  if (primeiro === 'movel' && segundo) return { pagina: 'movel', slug: segundo }
  if (primeiro === 'ambiente' && segundo === 'foto' && terceiro) return { pagina: 'ambiente', pronto: terceiro, foto: true }
  if (primeiro === 'ambiente') return { pagina: 'ambiente', pronto: segundo || undefined }
  return { pagina: 'inicio', secao: primeiro || undefined }
}

export function useRota() {
  const [rota, setRota] = useState(lerRota)

  useEffect(() => {
    const aoMudar = () => setRota(lerRota())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  return rota
}

export const hrefMovel = (slug: string) => `#/movel/${slug}`
export const hrefSecao = (secao: string) => `#/${secao}`
export const hrefAmbiente = '#/ambiente'
export const hrefPronto = (id: string) => `#/ambiente/${id}`
