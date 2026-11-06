/*
 * QR code → RA no celular. O QR code leva, além da página, o que a pessoa escolheu no computador (ou no
 * totem) e o pedido de abrir a câmera: `?ra=movel&cor=2&comp=1` na página do móvel, ou
 * `?ra=piso&piso=madeira&corPiso=%23aa8866` (ou `ra=parede`, com `papel` e `paredes`) para o provador
 * de acabamentos. No celular, a página abre já com a escolha e um botão para abrir a câmera.
 * (O navegador só abre a câmera e a RA depois de um toque da pessoa: não dá para abrir sozinho.)
 * Este arquivo é leve de propósito: é lido na abertura do site, antes de carregar o three.js.
 */

export type ConviteRA =
  | { tipo: 'movel'; cor: number; complemento: number }
  | { tipo: 'piso' | 'parede'; piso?: string; corPiso?: string; papel?: string; paredes?: string }

const CHAVES = ['ra', 'cor', 'comp', 'piso', 'corPiso', 'papel', 'paredes']
const HEX = /^#[0-9a-f]{6}$/i
const ID = /^[a-z0-9-]{1,32}$/

const numero = (v: string | null) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n < 100 ? n : 0
}
const valido = (v: string | null, re: RegExp) => (v && re.test(v) ? v : undefined)

/** O convite que veio no endereço (pelo QR code), ou null. */
export function lerConvite(): ConviteRA | null {
  const p = new URLSearchParams(window.location.search)
  const ra = p.get('ra')
  if (ra === 'movel') return { tipo: 'movel', cor: numero(p.get('cor')), complemento: numero(p.get('comp')) }
  if (ra === 'piso' || ra === 'parede')
    return {
      tipo: ra,
      piso: valido(p.get('piso'), ID),
      corPiso: valido(p.get('corPiso'), HEX),
      papel: valido(p.get('papel'), ID),
      paredes: valido(p.get('paredes'), HEX),
    }
  return null
}

/** Tira o convite do endereço: recarregar a página (ou voltar a ela) não pede de novo. */
export function limparConvite() {
  const url = new URL(window.location.href)
  if (!CHAVES.some((k) => url.searchParams.has(k))) return
  for (const k of CHAVES) url.searchParams.delete(k)
  history.replaceState(history.state, '', url.href)
}

/** Parâmetros do convite para pôr no link do QR code. */
export const parametrosConvite = (c: ConviteRA): Record<string, string> => {
  if (c.tipo === 'movel') return { ra: 'movel', cor: String(c.cor), comp: String(c.complemento) }
  const p: Record<string, string> = { ra: c.tipo }
  for (const k of ['piso', 'corPiso', 'papel', 'paredes'] as const) if (c[k]) p[k] = c[k]!
  return p
}
