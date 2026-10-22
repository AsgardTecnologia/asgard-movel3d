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
  porcelanato: 0.32,
  marmore: 0.22,
  ladrilho: 0.5,
  cimento: 0.78,
  carpete: 1,
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** Clareia (t > 0) ou escurece (t < 0) a cor. */
const tom = (hex: string, t: number, alfa = 1) => {
  const c = rgb(hex).map((v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)))
  return `rgba(${c.join(',')},${alfa})`
}

/** Aleatório com semente: o mesmo piso sai sempre igual. */
const sorteio = (semente: number) => () => {
  semente = (semente * 16807) % 2147483647
  return (semente - 1) / 2147483646
}

const LADO = 1024

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
    manchas(30, lado / 5, 0.1)
    const escuro = rgb(cor).reduce((s, v) => s + v, 0) < 300
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = escuro ? tom(cor, 0.5 + r() * 0.3, 0.35 + r() * 0.3) : tom(cor, -0.25 - r() * 0.25, 0.25 + r() * 0.3)
      g.lineWidth = 0.6 + r() * 2.2
      g.beginPath()
      let x = r() * lado
      let y = r() * lado
      g.moveTo(x, y)
      for (let k = 0; k < 8; k++) {
        const nx = x + (r() - 0.3) * lado * 0.25
        const ny = y + (r() - 0.5) * lado * 0.18
        g.quadraticCurveTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, nx, ny)
        x = nx
        y = ny
      }
      g.stroke()
    }
    rejunte(0.8 * px, false)
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
