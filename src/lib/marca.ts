import { useSyncExternalStore } from 'react'
import { empresa } from '../config'

/** Nome e cores com que o site é exibido. Começa com a nossa marca; o visitante troca pela da loja dele. */
export type Marca = {
  nome: string
  /** Botões, faixas e fundos escuros (verde musgo). */
  principal: string
  /** Seções claras (creme). */
  fundo: string
  /** Títulos em itálico, selos e botões de RA (tijolo). */
  destaque: string
  /** Atrás dos móveis (fotos e 3D) e em algumas seções (bege). */
  estudio: string
}

export const marcaPadrao: Marca = {
  nome: empresa.nome,
  principal: '#2d3a2e',
  fundo: '#f3eee6',
  destaque: '#b0603a',
  estudio: '#ebe6dc',
}

const chavesCores = ['principal', 'fundo', 'destaque', 'estudio'] as const

const CHAVE = 'marca'
const hexValido = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

const lerMarca = (): Marca => {
  const params = new URLSearchParams(window.location.search)
  const cores = params.get('cores')?.split('-').map((c) => `#${c}`)
  if (params.get('loja') || cores) {
    const m = { ...marcaPadrao, nome: params.get('loja')?.trim() || marcaPadrao.nome }
    // Links antigos têm só 3 cores; a quarta fica a padrão.
    if (cores && cores.length >= 3 && cores.every(hexValido)) chavesCores.forEach((c, i) => cores[i] && (m[c] = cores[i]))
    salvar(m)
    return m
  }
  try {
    const salva = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Marca | null
    if (salva && [salva.principal, salva.fundo, salva.destaque].every(hexValido)) {
      const m = { ...marcaPadrao, ...salva }
      return hexValido(m.estudio) ? m : { ...m, estudio: marcaPadrao.estudio }
    }
  } catch {
    // Sem acesso ao armazenamento (aba anônima, prévia): fica a marca padrão.
  }
  return marcaPadrao
}

const salvar = (m: Marca) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(m))
  } catch {
    // idem
  }
}

let marca = lerMarca()
const ouvintes = new Set<() => void>()
const assinar = (fn: () => void) => {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export const useMarca = () => useSyncExternalStore(assinar, () => marca)

export const personalizada = (m: Marca) => m.nome !== marcaPadrao.nome || coresMudaram(m)

export function definirMarca(parcial: Partial<Marca>) {
  marca = { ...marca, ...parcial }
  salvar(marca)
  aplicarTema(marca)
  ouvintes.forEach((fn) => fn())
}

export const restaurarMarca = () => definirMarca(marcaPadrao)

/** O visitante já trocou o nome pelo da loja dele. */
export const temNomeProprio = (m: Marca) => m.nome !== marcaPadrao.nome

/** Final das mensagens de WhatsApp para nós, quando já sabemos de qual loja é o contato. */
export const assinatura = (m: Marca) => (temNomeProprio(m) ? ` Sou da loja ${m.nome}.` : '')

/** "Casa Lume & Cia" → "casalumecia.com.br", para os endereços dos mockups. */
export const dominio = (nome: string) =>
  `${
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'sualoja'
  }.com.br`

/** Link que abre o site já com o nome e as cores da loja, para mandar ao cliente. */
export const linkPersonalizado = (m: Marca) => {
  const url = new URL(window.location.href)
  url.search = new URLSearchParams({
    loja: m.nome,
    cores: chavesCores.map((c) => m[c].slice(1)).join('-'),
  }).toString()
  return url.href
}

// --- Contraste ---------------------------------------------------------------

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const paraHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const misturar = (hex: string, alvo: number, t: number) => paraHex(rgb(hex).map((v) => v + (alvo - v) * t))

const luminancia = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Escurece (ou clareia) a cor aos poucos até o texto em cima dela ficar legível. */
const ajustar = (hex: string, texto: string, minimo: number, alvo: 0 | 255) => {
  let cor = hex
  for (let t = 0.08; contraste(cor, texto) < minimo && t <= 1; t += 0.08) cor = misturar(hex, alvo, t)
  return cor
}

/** As cores que o site usa de fato: a escolhida, ou uma versão ajustada quando o texto não ficaria legível. */
export const coresLegiveis = (m: Marca) => ({
  principal: ajustar(m.principal, '#fbf9f5', 4.5, 0),
  destaque: ajustar(m.destaque, '#fbf9f5', 3.2, 0),
  fundo: ajustar(m.fundo, '#1c1e1a', 12, 255),
  estudio: ajustar(m.estudio, '#1c1e1a', 10, 255),
})

// --- Tema --------------------------------------------------------------------

/** Troca as variáveis de cor do Tailwind. Na marca padrão, volta às cores originais do index.css. */
export function aplicarTema(m: Marca) {
  const raiz = document.documentElement.style
  const nomes = ['musgo', 'musgo-escuro', 'terracota', 'terracota-escuro', 'destaque-claro', 'creme', 'linho', 'areia', 'estudio']
  document.title = personalizada(m) ? `${m.nome} · Catálogo em 3D` : `${empresa.nome} · Seu catálogo em 3D e realidade aumentada`

  if (!coresMudaram(m)) {
    nomes.forEach((n) => raiz.removeProperty(`--color-${n}`))
    return
  }

  const c = coresLegiveis(m)
  const vars: Record<string, string> = {
    musgo: c.principal,
    'musgo-escuro': misturar(c.principal, 0, 0.3),
    terracota: c.destaque,
    'terracota-escuro': misturar(c.destaque, 0, 0.17),
    'destaque-claro': misturar(c.destaque, 255, 0.4),
    creme: c.fundo,
    linho: misturar(c.fundo, 255, 0.65),
    areia: misturar(c.fundo, 0, 0.05),
    estudio: c.estudio,
  }
  Object.entries(vars).forEach(([n, v]) => raiz.setProperty(`--color-${n}`, v))
}

function coresMudaram(m: Marca) {
  return chavesCores.some((c) => m[c] !== marcaPadrao[c])
}

aplicarTema(marca)

// --- Painel "Personalizar" ---------------------------------------------------

let painelAberto = false
const ouvintesPainel = new Set<() => void>()

export const usePainel = () =>
  useSyncExternalStore(
    (fn) => {
      ouvintesPainel.add(fn)
      return () => ouvintesPainel.delete(fn)
    },
    () => painelAberto,
  )

export const abrirPainel = (aberto = true) => {
  painelAberto = aberto
  ouvintesPainel.forEach((fn) => fn())
}
