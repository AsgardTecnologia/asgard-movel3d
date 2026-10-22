import { useEffect, useState } from 'react'

export type Rota = { pagina: 'inicio'; secao?: string } | { pagina: 'movel'; slug: string } | { pagina: 'ambiente' }

const lerRota = (): Rota => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [primeiro, segundo] = hash.split('/')
  if (primeiro === 'movel' && segundo) return { pagina: 'movel', slug: segundo }
  if (primeiro === 'ambiente') return { pagina: 'ambiente' }
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
