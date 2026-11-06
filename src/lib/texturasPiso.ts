import type { TipoPiso } from './ambiente'

/** Lado do desenho de cada piso, em metros: a textura se repete a cada `tamanho`. */
export const tamanhoPiso: Record<TipoPiso, number> = {
  madeira: 1.6,
  porcelanato: 1.2,
  marmore: 1.6,
  ladrilho: 0.8,
  cimento: 2.4,
  carpete: 0.6,
}

/** Brilho do acabamento (roughness do material): mármore e porcelanato refletem mais. */
export const asperezaPiso: Record<TipoPiso, number> = {
  madeira: 0.62,
  porcelanato: 0.42,
  marmore: 0.36,
  ladrilho: 0.5,
  cimento: 0.78,
  carpete: 1,
}

export const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** Clareia (t > 0) ou escurece (t < 0) a cor. */
export const tom = (hex: string, t: number, alfa = 1) => {
  const c = rgb(hex).map((v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)))
  return `rgba(${c.join(',')},${alfa})`
}

/** Aleatório com semente: o mesmo piso sai sempre igual. */
export const sorteio = (semente: number) => () => {
  semente = (semente * 16807) % 2147483647
  return (semente - 1) / 2147483646
}

const LADO = 1024

/** Ruído suave que se repete a cada lado do desenho (a textura emenda sem costura). */
function ruidoPeriodico(r: () => number, n: number) {
  const grade = Float32Array.from({ length: n * n }, () => r())
  const em = (i: number, j: number) => grade[(((j % n) + n) % n) * n + (((i % n) + n) % n)]
  return (u: number, v: number) => {
    const x = u * n
    const y = v * n
    const i = Math.floor(x)
    const j = Math.floor(y)
    const fx = x - i
    const fy = y - j
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = em(i, j) + (em(i + 1, j) - em(i, j)) * sx
    const b = em(i, j + 1) + (em(i + 1, j + 1) - em(i, j + 1)) * sx
    return a + (b - a) * sy
  }
}

/**
 * Mármore: nuvens suaves e veios finos que serpenteiam (um seno torcido por ruído em várias escalas),
 * como numa placa de verdade, em vez de traços soltos.
 */
function desenharMarmore(g: CanvasRenderingContext2D, cor: string, lado: number, r: () => number) {
  const oitavas = [4, 8, 16, 32].map((n) => ruidoPeriodico(r, n))
  const turbulencia = (u: number, v: number) =>
    oitavas.reduce((s, f, k) => s + (f(u, v) - 0.5) / 2 ** k, 0)
  const nuvem = ruidoPeriodico(r, 3)
  const [cr, cg, cb] = rgb(cor)
  const escuro = cr + cg + cb < 300
  // Veio: escuro no mármore claro, claro no escuro; um pouco puxado para o cinza quente.
  const veio = escuro ? [235, 228, 216] : [Math.max(0, cr - 95), Math.max(0, cg - 92), Math.max(0, cb - 85)]
  const img = g.createImageData(lado, lado)
  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      const u = x / lado
      const v = y / lado
      const t = turbulencia(u, v)
      // Veio principal (fino e marcado) e um secundário (largo e suave), em direções diferentes.
      const v1 = Math.abs(Math.sin(Math.PI * 2 * (2 * u + v) + t * 9))
      const v2 = Math.abs(Math.sin(Math.PI * 2 * (u - 3 * v) + t * 6 + 1.7))
      const forte = (1 - Math.min(1, v1 / 0.05)) ** 2 * 0.75
      const fraco = (1 - Math.min(1, v2 / 0.22)) ** 2 * 0.22
      const k = Math.min(0.85, forte + fraco)
      const brilho = 1 + (nuvem(u, v) - 0.5) * 0.07 + t * 0.04
      const i = (y * lado + x) * 4
      img.data[i] = Math.min(255, (cr * (1 - k) + veio[0] * k) * brilho)
      img.data[i + 1] = Math.min(255, (cg * (1 - k) + veio[1] * k) * brilho)
      img.data[i + 2] = Math.min(255, (cb * (1 - k) + veio[2] * k) * brilho)
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
}

export function desenharPiso(tipo: TipoPiso, cor: string, lado = LADO) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = lado
  const g = canvas.getContext('2d')!
  const r = sorteio(42)
  const px = lado / tamanhoPiso[tipo] // pixels por metro
  g.fillStyle = cor
  g.fillRect(0, 0, lado, lado)

  const manchas = (n: number, raio: number, forca: number) => {
    for (let i = 0; i < n; i++) {
      const x = r() * lado
      const y = r() * lado
      const rr = raio * (0.4 + r())
      const grad = g.createRadialGradient(x, y, 0, x, y, rr)
      grad.addColorStop(0, tom(cor, (r() - 0.5) * forca, 0.5))
      grad.addColorStop(1, tom(cor, 0, 0))
      g.fillStyle = grad
      // Repete nas bordas para a textura emendar sem costura.
      for (const dx of [-lado, 0, lado]) for (const dy of [-lado, 0, lado]) g.fillRect(x - rr + dx, y - rr + dy, rr * 2, rr * 2)
    }
  }

  const rejunte = (passo: number, claro: boolean) => {
    g.strokeStyle = claro ? tom(cor, 0.35, 0.9) : tom(cor, -0.35, 0.8)
    g.lineWidth = Math.max(2, lado / 400)
    for (let v = 0; v <= lado; v += passo) {
      g.beginPath()
      g.moveTo(v, 0)
      g.lineTo(v, lado)
      g.moveTo(0, v)
      g.lineTo(lado, v)
      g.stroke()
    }
  }

  if (tipo === 'madeira') {
    const largura = 0.2 * px
    for (let y = 0; y < lado; y += largura) {
      let x = -r() * lado * 0.5
      while (x < lado) {
        const comp = (0.8 + r() * 0.8) * px
        const t = (r() - 0.5) * 0.14
        g.fillStyle = tom(cor, t)
        g.fillRect(x, y, comp, largura)
        // Veios: linhas finas onduladas ao longo da tábua.
        for (let k = 0; k < 9; k++) {
          const yy = y + r() * largura
          const amp = r() * 3
          const fase = r() * 10
          g.strokeStyle = tom(cor, -0.12 - r() * 0.18, 0.45)
          g.lineWidth = 0.6 + r() * 1.4
          g.beginPath()
          for (let xx = x; xx <= x + comp; xx += 12) {
            const yv = yy + Math.sin(xx / 60 + fase) * amp
            if (xx === x) g.moveTo(xx, yv)
            else g.lineTo(xx, yv)
          }
          g.stroke()
        }
        g.fillStyle = tom(cor, -0.5, 0.85)
        g.fillRect(x + comp - 1.5, y, 3, largura)
        // Tábua que passa da borda continua do outro lado.
        if (x + comp > lado) {
          g.fillStyle = tom(cor, t)
          g.fillRect(x - lado, y, comp, largura)
        }
        x += comp
      }
      g.fillStyle = tom(cor, -0.5, 0.85)
      g.fillRect(0, y - 1.5, lado, 3)
    }
  } else if (tipo === 'porcelanato') {
    manchas(40, lado / 6, 0.08)
    const passo = 0.6 * px
    for (let x = 0; x < lado; x += passo)
      for (let y = 0; y < lado; y += passo) {
        g.fillStyle = tom(cor, (r() - 0.5) * 0.06, 0.6)
        g.fillRect(x, y, passo, passo)
      }
    rejunte(passo, false)
  } else if (tipo === 'marmore') {
    // O mármore é calculado pixel a pixel: no máximo 512 de lado, ampliado depois (veio suave não perde).
    const calc = Math.min(lado, 512)
    if (calc === lado) desenharMarmore(g, cor, lado, r)
    else {
      const menor = document.createElement('canvas')
      menor.width = menor.height = calc
      desenharMarmore(menor.getContext('2d')!, cor, calc, r)
      g.imageSmoothingQuality = 'high'
      g.drawImage(menor, 0, 0, lado, lado)
    }
    // Rejunte fino e claro, quase invisível, como no mármore assentado.
    g.globalAlpha = 0.55
    rejunte(0.8 * px, rgb(cor).reduce((s, v) => s + v, 0) < 300)
    g.globalAlpha = 1
  } else if (tipo === 'ladrilho') {
    const passo = 0.2 * px
    for (let x = 0; x < lado; x += passo)
      for (let y = 0; y < lado; y += passo) {
        g.fillStyle = tom(cor, (r() - 0.5) * 0.18)
        g.fillRect(x, y, passo, passo)
      }
    rejunte(passo, true)
  } else if (tipo === 'cimento') {
    manchas(120, lado / 5, 0.22)
    manchas(300, lado / 30, 0.18)
  } else {
    // Carpete: trama fina.
    const img = g.getImageData(0, 0, lado, lado)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (r() - 0.5) * 34
      img.data[i] += v
      img.data[i + 1] += v
      img.data[i + 2] += v
    }
    g.putImageData(img, 0, 0)
  }
  return canvas
}

const miniaturas = new Map<string, string>()

/** Amostra pequena do piso para os botões do painel. */
export function miniaturaPiso(tipo: TipoPiso, cor: string) {
  const chave = `${tipo}${cor}`
  if (!miniaturas.has(chave)) {
    const grande = desenharPiso(tipo, cor, 256)
    miniaturas.set(chave, grande.toDataURL('image/jpeg', 0.8))
  }
  return miniaturas.get(chave)!
}
