import * as THREE from 'three'

/**
 * Revestimentos fotografados (Poly Haven, CC0; arquivos em `public/texturas`): cor, relevo e rugosidade de material
 * de verdade. A foto é retingida na cor escolhida pela pessoa, mantendo o desenho (veios, rejunte, poros), então a
 * paleta do editor continua valendo. Enquanto a foto carrega, a cena usa o desenho gerado em código.
 */
type Config = {
  /** Lado da foto, em metros. */
  metros: number
  /** Quanto o claro/escuro da foto aparece na cor escolhida (1 = como na foto). */
  contraste: number
  /** Força do relevo. */
  relevo: number
  /** Multiplica a rugosidade da foto (< 1 deixa mais polido). */
  aspereza: number
}

const CONFIG: Record<string, Config> = {
  'piso-madeira': { metros: 1.7, contraste: 1, relevo: 1, aspereza: 0.85 },
  'piso-marmore': { metros: 2, contraste: 1, relevo: 0.4, aspereza: 0.45 },
  'piso-ladrilho': { metros: 1.9, contraste: 0.9, relevo: 1, aspereza: 0.8 },
  'piso-cimento': { metros: 2, contraste: 0.8, relevo: 0.8, aspereza: 1 },
  'parede-tijolinho': { metros: 1, contraste: 1, relevo: 1.4, aspereza: 1 },
  'parede-pedra': { metros: 2, contraste: 1, relevo: 1.4, aspereza: 1 },
  'parede-azulejo': { metros: 1.27, contraste: 0.8, relevo: 0.8, aspereza: 0.4 },
  'parede-marmore': { metros: 1.5, contraste: 1, relevo: 0.3, aspereza: 0.4 },
  'parede-cimento': { metros: 2, contraste: 0.7, relevo: 0.8, aspereza: 1 },
  'parede-lisa': { metros: 1, contraste: 0.18, relevo: 0.35, aspereza: 1 },
}

export type Foto = {
  config: Config
  cor: HTMLImageElement
  /** Luminância média da foto, para retingir sem mudar o brilho geral. */
  media: number
  normal: THREE.Texture
  aspereza: THREE.Texture
}

const fotos = new Map<string, Foto | 'carregando' | 'erro'>()
const ouvintes = new Set<() => void>()

/** Avisa quando uma foto termina de carregar (a cena troca o desenho pela foto). */
export function aoCarregarFoto(f: () => void) {
  ouvintes.add(f)
  return () => void ouvintes.delete(f)
}

const base = `${import.meta.env.BASE_URL}texturas/`

const imagem = (url: string) =>
  new Promise<HTMLImageElement>((ok, falha) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => ok(img)
    img.onerror = falha
    img.src = url
  })

function luminanciaMedia(img: HTMLImageElement) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, 64, 64)
  const d = g.getImageData(0, 0, 64, 64).data
  let s = 0
  for (let i = 0; i < d.length; i += 4) s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
  return s / (d.length / 4)
}

async function carregar(nome: string) {
  const config = CONFIG[nome]
  const [cor, normal, aspereza] = await Promise.all(['cor', 'normal', 'aspereza'].map((m) => imagem(`${base}${nome}/${m}.jpg`)))
  const tex = (img: HTMLImageElement) => {
    const t = new THREE.Texture(img)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.NoColorSpace
    t.repeat.setScalar(1 / config.metros)
    t.needsUpdate = true
    return t
  }
  return { config, cor, media: luminanciaMedia(cor), normal: tex(normal), aspereza: tex(aspereza) } satisfies Foto
}

/** A foto do revestimento, se já carregou; na primeira chamada começa a carregar. */
export function foto(nome: string): Foto | null {
  if (!CONFIG[nome]) return null
  const f = fotos.get(nome)
  if (f && typeof f === 'object') return f
  if (!f) {
    fotos.set(nome, 'carregando')
    carregar(nome)
      .then((pronta) => {
        fotos.set(nome, pronta)
        for (const o of ouvintes) o()
      })
      .catch(() => fotos.set(nome, 'erro'))
  }
  return null
}

const tingidas = new Map<string, HTMLCanvasElement>()

/** A foto retingida na cor escolhida: claro e escuro da foto, na cor da pessoa. */
export function fotoNaCor(f: Foto, cor: string, lado = 1024) {
  const chave = `${f.cor.src}${cor}${lado}`
  const pronta = tingidas.get(chave)
  if (pronta) return pronta
  const c = document.createElement('canvas')
  c.width = c.height = lado
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(f.cor, 0, 0, lado, lado)
  const img = g.getImageData(0, 0, lado, lado)
  const d = img.data
  const [r0, g0, b0] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16))
  const k = f.config.contraste
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    const fator = Math.max(0.15, 1 + (lum / f.media - 1) * k)
    d[i] = Math.min(255, r0 * fator)
    d[i + 1] = Math.min(255, g0 * fator)
    d[i + 2] = Math.min(255, b0 * fator)
  }
  g.putImageData(img, 0, 0)
  tingidas.set(chave, c)
  return c
}

/** Começa a baixar as fotos já (antes de alguém abrir um ambiente). */
export function precarregarFotos() {
  for (const nome of Object.keys(CONFIG)) foto(nome)
}
