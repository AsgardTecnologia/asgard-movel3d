import * as THREE from 'three'
import { desenharPiso } from './texturasPiso'

/** Revestimentos de parede e texturas das peças. Cada uma é desenhada já na cor escolhida. */
export type TipoTextura =
  | 'tijolo'
  | 'ripado'
  | 'cimento'
  | 'azulejo'
  | 'marmore'
  | 'pedra'
  | 'madeira'
  | 'granito'
  | 'tecido'
  | 'grama'
  | 'pastilha'

/** Lado do desenho, em metros: a textura se repete a cada `tamanho`. */
export const tamanhoTextura: Record<TipoTextura, number> = {
  tijolo: 1.2,
  ripado: 0.6,
  cimento: 2.4,
  azulejo: 0.8,
  marmore: 1.6,
  pedra: 1,
  madeira: 0.8,
  granito: 0.6,
  tecido: 0.25,
  grama: 2,
  pastilha: 0.5,
}

export const asperezaTextura: Partial<Record<TipoTextura, number>> = {
  azulejo: 0.25,
  marmore: 0.2,
  granito: 0.18,
  pastilha: 0.15,
  tecido: 1,
  grama: 1,
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const tom = (hex: string, t: number, alfa = 1) => {
  const c = rgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)))))
  return `rgba(${c.join(',')},${alfa})`
}
const sorteio = (semente: number) => () => {
  semente = (semente * 16807) % 2147483647
  return (semente - 1) / 2147483646
}

export function desenharTextura(tipo: TipoTextura, cor: string, lado = 512) {
  if (tipo === 'cimento' || tipo === 'marmore') return desenharPiso(tipo, cor, lado)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = lado
  const g = canvas.getContext('2d')!
  const r = sorteio(7)
  const px = lado / tamanhoTextura[tipo]
  g.fillStyle = cor
  g.fillRect(0, 0, lado, lado)

  const ruido = (forca: number) => {
    const img = g.getImageData(0, 0, lado, lado)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (r() - 0.5) * forca
      img.data[i] += v
      img.data[i + 1] += v
      img.data[i + 2] += v
    }
    g.putImageData(img, 0, 0)
  }

  /** Fiadas de peças desencontradas (tijolo, azulejo metrô). */
  const fiadas = (l: number, a: number, junta: number, corJunta: string, variacao: number) => {
    g.fillStyle = corJunta
    g.fillRect(0, 0, lado, lado)
    const linhas = Math.round(lado / (a * px))
    const colunas = Math.round(lado / (l * px))
    const pl = lado / colunas
    const pa = lado / linhas
    const j = junta * px
    for (let i = 0; i < linhas; i++)
      for (let k = -1; k < colunas; k++) {
        const x = k * pl + (i % 2 ? pl / 2 : 0)
        g.fillStyle = tom(cor, (r() - 0.5) * variacao)
        g.fillRect(x + j / 2, i * pa + j / 2, pl - j, pa - j)
      }
  }

  if (tipo === 'tijolo') {
    fiadas(0.24, 0.075, 0.012, tom(cor, 0.55), 0.3)
    ruido(26)
  } else if (tipo === 'azulejo') {
    fiadas(0.2, 0.1, 0.004, tom(cor, -0.18), 0.05)
    // Brilho suave no meio de cada peça.
    ruido(6)
  } else if (tipo === 'pastilha') {
    fiadas(0.025, 0.025, 0.003, tom(cor, 0.5), 0.18)
  } else if (tipo === 'ripado') {
    const ripa = 0.045 * px
    const vao = 0.015 * px
    g.fillStyle = tom(cor, -0.6)
    g.fillRect(0, 0, lado, lado)
    for (let x = 0; x < lado; x += ripa + vao) {
      g.fillStyle = tom(cor, (r() - 0.5) * 0.12)
      g.fillRect(x, 0, ripa, lado)
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = tom(cor, -0.15 - r() * 0.15, 0.4)
        g.lineWidth = 0.8 + r()
        const xx = x + r() * ripa
        g.beginPath()
        g.moveTo(xx, 0)
        g.bezierCurveTo(xx + (r() - 0.5) * 4, lado / 3, xx + (r() - 0.5) * 4, (lado * 2) / 3, xx, lado)
        g.stroke()
      }
      g.fillStyle = tom(cor, 0.12, 0.6)
      g.fillRect(x, 0, 1.5, lado)
    }
  } else if (tipo === 'madeira') {
    for (let k = 0; k < 70; k++) {
      g.strokeStyle = tom(cor, (r() - 0.6) * 0.3, 0.35 + r() * 0.3)
      g.lineWidth = 0.6 + r() * 2.4
      const x = r() * lado
      const amp = 2 + r() * 8
      const fase = r() * 6
      g.beginPath()
      for (let y = -10; y <= lado + 10; y += 16) {
        const xv = x + Math.sin(y / 70 + fase) * amp
        if (y < 0) g.moveTo(xv, y)
        else g.lineTo(xv, y)
      }
      g.stroke()
    }
    ruido(10)
  } else if (tipo === 'pedra') {
    // Canjiquinha: filetes de pedra de comprimentos variados.
    g.fillStyle = tom(cor, -0.5)
    g.fillRect(0, 0, lado, lado)
    let y = 0
    while (y < lado) {
      const a = (0.025 + r() * 0.03) * px
      let x = -r() * 40
      while (x < lado) {
        const l = (0.1 + r() * 0.25) * px
        g.fillStyle = tom(cor, (r() - 0.5) * 0.45)
        g.fillRect(x + 1.5, y + 1.5, l - 3, a - 3)
        x += l
      }
      y += a
    }
    ruido(22)
  } else if (tipo === 'granito') {
    const escuro = rgb(cor).reduce((s, v) => s + v, 0) < 300
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = escuro ? tom(cor, 0.2 + r() * 0.5, 0.5) : tom(cor, -0.2 - r() * 0.4, 0.45)
      const s = 0.5 + r() * 2.5
      g.fillRect(r() * lado, r() * lado, s, s)
    }
  } else if (tipo === 'grama') {
    for (let k = 0; k < 14000; k++) {
      g.strokeStyle = tom(cor, (r() - 0.5) * 0.5, 0.7)
      g.lineWidth = 1 + r()
      const x = r() * lado
      const y = r() * lado
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6)
      g.stroke()
    }
  } else if (tipo === 'tecido') {
    for (let y = 0; y < lado; y += 3) {
      g.fillStyle = tom(cor, (r() - 0.5) * 0.08, 0.6)
      g.fillRect(0, y, lado, 1.5)
    }
    ruido(18)
  }
  return canvas
}

// --- Cache das texturas do three.js ---------------------------------------------

const cache = new Map<string, THREE.CanvasTexture>()
const LIMITE = 40

/** Textura repetida a cada `tamanhoTextura` metros, para usar com `projetarUV`. */
export function textura(tipo: TipoTextura, cor: string) {
  const chave = `${tipo}${cor}`
  let t = cache.get(chave)
  if (t) {
    // Mais recente no fim: o cache descarta as mais antigas.
    cache.delete(chave)
    cache.set(chave, t)
    return t
  }
  t = new THREE.CanvasTexture(desenharTextura(tipo, cor))
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.setScalar(1 / tamanhoTextura[tipo])
  t.anisotropy = 8
  cache.set(chave, t)
  if (cache.size > LIMITE) {
    const [velha, tv] = cache.entries().next().value!
    cache.delete(velha)
    // Se ainda estiver em uso, o three.js envia de novo para a placa de vídeo.
    tv.dispose()
  }
  return t
}

/**
 * Coordenadas de textura em metros, projetadas pela face (caixa): a textura fica no tamanho real
 * em qualquer peça, sem esticar. `desvio` continua o desenho entre pedaços da mesma parede.
 */
export function projetarUV(geo: THREE.BufferGeometry, desvio = { u: 0, v: 0 }) {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  if (!pos || !nor) return geo
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i))
    const ny = Math.abs(nor.getY(i))
    const nz = Math.abs(nor.getZ(i))
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    let u: number
    let v: number
    if (ny >= nx && ny >= nz) [u, v] = [x, z]
    else if (nx >= nz) [u, v] = [z, y]
    else [u, v] = [x, y]
    uv[i * 2] = u + desvio.u
    uv[i * 2 + 1] = v + desvio.v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}
