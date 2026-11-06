import * as THREE from 'three'

/**
 * Relevo e brilho tirados do próprio desenho da textura: o que é escuro (rejunte, fresta entre tábuas,
 * junta de tijolo, veio da madeira) afunda, e o que é claro fica em cima. Dá a sensação de material de verdade
 * quando a luz bate de lado, sem precisar de foto.
 */
export type OpcoesRelevo = {
  /** Profundidade do relevo (1 = normal). */
  forca: number
  /** Aspereza média do acabamento (0 polido, 1 fosco). */
  aspereza: number
  /** Quanto o brilho varia junto com o desenho (rejunte fosco, peça polida). */
  variacao?: number
  /** Raio do desfoque antes de calcular o relevo, em pixels do mapa (suaviza bordas). */
  suavizar?: number
}

const LADO = 512

function alturas(fonte: HTMLCanvasElement, suavizar: number) {
  const c = document.createElement('canvas')
  c.width = c.height = LADO
  const g = c.getContext('2d')!
  // Desenha 3x3 vezes para o desfoque emendar nas bordas (a textura se repete).
  if (suavizar > 0) g.filter = `blur(${suavizar}px)`
  for (const dx of [-LADO, 0, LADO]) for (const dy of [-LADO, 0, LADO]) g.drawImage(fonte, dx, dy, LADO, LADO)
  const d = g.getImageData(0, 0, LADO, LADO).data
  const h = new Float32Array(LADO * LADO)
  let soma = 0
  for (let i = 0; i < h.length; i++) {
    h[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255
    soma += h[i]
  }
  return { h, media: soma / h.length }
}

const cacheRelevo = new WeakMap<HTMLCanvasElement, Map<string, { normal: THREE.Texture; rugosidade: THREE.Texture }>>()

/** Mapa de normais (relevo) e de rugosidade a partir do desenho. */
export function mapasDeRelevo(fonte: HTMLCanvasElement, o: OpcoesRelevo) {
  const chave = `${o.forca}|${o.aspereza}|${o.variacao}|${o.suavizar}`
  let porFonte = cacheRelevo.get(fonte)
  if (!porFonte) cacheRelevo.set(fonte, (porFonte = new Map()))
  const pronto = porFonte.get(chave)
  if (pronto) return pronto

  const { h, media } = alturas(fonte, o.suavizar ?? 1)
  const em = (x: number, y: number) => h[((y + LADO) % LADO) * LADO + ((x + LADO) % LADO)]

  const normal = document.createElement('canvas')
  const rug = document.createElement('canvas')
  normal.width = normal.height = rug.width = rug.height = LADO
  const nImg = normal.getContext('2d')!.createImageData(LADO, LADO)
  const rImg = rug.getContext('2d')!.createImageData(LADO, LADO)
  const forca = o.forca * 6
  const variacao = o.variacao ?? 0.3

  for (let y = 0; y < LADO; y++)
    for (let x = 0; x < LADO; x++) {
      // Sobel: inclinação nas duas direções.
      const dx =
        em(x + 1, y - 1) + 2 * em(x + 1, y) + em(x + 1, y + 1) - (em(x - 1, y - 1) + 2 * em(x - 1, y) + em(x - 1, y + 1))
      const dy =
        em(x - 1, y + 1) + 2 * em(x, y + 1) + em(x + 1, y + 1) - (em(x - 1, y - 1) + 2 * em(x, y - 1) + em(x + 1, y - 1))
      let nx = -dx * forca
      let ny = dy * forca
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const i = (y * LADO + x) * 4
      nImg.data[i] = (nx * 0.5 + 0.5) * 255
      nImg.data[i + 1] = (ny * 0.5 + 0.5) * 255
      nImg.data[i + 2] = (nz * 0.5 + 0.5) * 255
      nImg.data[i + 3] = 255
      // Partes baixas (rejunte, fresta) ficam mais foscas; as altas, um pouco mais polidas.
      const desvio = em(x, y) - media
      const r = Math.min(1, Math.max(0.04, o.aspereza - desvio * variacao * 2))
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = r * 255
      rImg.data[i + 3] = 255
    }
  normal.getContext('2d')!.putImageData(nImg, 0, 0)
  rug.getContext('2d')!.putImageData(rImg, 0, 0)

  const textura = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.NoColorSpace
    return t
  }
  const res = { normal: textura(normal), rugosidade: textura(rug) }
  porFonte.set(chave, res)
  return res
}

/** Massa corrida com pintura: granulado bem fino de rolo, para a parede lisa não parecer plástico. */
let reboco: HTMLCanvasElement | null = null
export function desenhoReboco() {
  if (reboco) return reboco
  reboco = document.createElement('canvas')
  reboco.width = reboco.height = 256
  const g = reboco.getContext('2d')!
  const img = g.createImageData(256, 256)
  let s = 11
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 70
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return reboco
}
