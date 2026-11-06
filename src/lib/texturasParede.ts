import type { TipoPapel } from './ambiente'
import { desenharTextura, tamanhoTextura } from './texturas'
import { rgb, sorteio, tom } from './texturasPiso'

/** Lado do desenho de cada papel de parede, em metros: a textura se repete a cada `tamanho`. */
export const tamanhoPapel: Record<TipoPapel, number> = {
  lisa: 1,
  linho: 0.4,
  listras: 0.6,
  losangos: 0.5,
  tijolinho: 0.96,
  ripado: 0.6,
  marmore: tamanhoTextura.marmore,
  azulejo: tamanhoTextura.azulejo,
  pedra: tamanhoTextura.pedra,
  cimento: tamanhoTextura.cimento,
}

/** Revestimentos desenhados junto com os acabamentos das peças (src/lib/texturas.ts). */
const deTexturas = new Set<TipoPapel>(['marmore', 'azulejo', 'pedra', 'cimento'])

const LADO = 1024

/** Desenha o papel na cor da parede. A pintura lisa ganha só um granulado leve de rolo. */
export function desenharPapel(tipo: TipoPapel, cor: string, lado = LADO) {
  if (deTexturas.has(tipo)) return desenharTextura(tipo as 'marmore', cor, lado)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = lado
  const g = canvas.getContext('2d')!
  const r = sorteio(7)
  const px = lado / tamanhoPapel[tipo] // pixels por metro
  const escuro = rgb(cor).reduce((s, v) => s + v, 0) < 300
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

  if (tipo === 'linho') {
    // Fios finos nas duas direções, cada um num tom.
    for (let v = 0; v < lado; v += 3) {
      g.fillStyle = tom(cor, (r() - 0.5) * 0.14, 0.45)
      g.fillRect(0, v, lado, 1.5)
      g.fillStyle = tom(cor, (r() - 0.5) * 0.14, 0.3)
      g.fillRect(v, 0, 1.5, lado)
    }
    ruido(10)
  } else if (tipo === 'listras') {
    const faixa = 0.1 * px
    for (let x = 0, i = 0; x < lado; x += faixa, i++) {
      g.fillStyle = i % 2 ? tom(cor, escuro ? 0.12 : -0.1) : cor
      g.fillRect(x, 0, faixa, lado)
      g.fillStyle = tom(cor, escuro ? 0.3 : 0.35, 0.7)
      g.fillRect(x - 1, 0, 2, lado)
    }
    ruido(5)
  } else if (tipo === 'losangos') {
    g.strokeStyle = escuro ? tom(cor, 0.35, 0.8) : tom(cor, -0.22, 0.8)
    g.lineWidth = Math.max(2, lado / 260)
    const passo = lado / 2
    for (let k = -2; k <= 2; k++) {
      g.beginPath()
      g.moveTo(k * passo, 0)
      g.lineTo(k * passo + lado, lado)
      g.moveTo(k * passo + lado, 0)
      g.lineTo(k * passo, lado)
      g.stroke()
    }
    // Ponto nos cruzamentos.
    g.fillStyle = g.strokeStyle
    for (let x = 0; x <= lado; x += passo / 2)
      for (let y = (x / (passo / 2)) % 2 ? passo / 2 : 0; y <= lado; y += passo) {
        g.beginPath()
        g.arc(x, y, lado / 130, 0, Math.PI * 2)
        g.fill()
      }
    ruido(5)
  } else if (tipo === 'tijolinho') {
    const largura = 0.24 * px
    const altura = 0.08 * px
    const junta = 0.012 * px
    g.fillStyle = tom(cor, escuro ? 0.25 : 0.4)
    g.fillRect(0, 0, lado, lado)
    for (let y = 0, linha = 0; y < lado; y += altura, linha++) {
      for (let x = linha % 2 ? -largura / 2 : 0; x < lado; x += largura) {
        g.fillStyle = tom(cor, (r() - 0.5) * 0.2)
        g.fillRect(x + junta / 2, y + junta / 2, largura - junta, altura - junta)
        // Tijolo cortado na borda continua do outro lado.
        if (x < 0) g.fillRect(x + lado + junta / 2, y + junta / 2, largura - junta, altura - junta)
      }
    }
    ruido(22)
  } else if (tipo === 'ripado') {
    const ripa = 0.06 * px
    const fresta = 0.012 * px
    for (let x = 0; x < lado; x += ripa) {
      g.fillStyle = tom(cor, (r() - 0.5) * 0.1)
      g.fillRect(x, 0, ripa, lado)
      // Veios ao longo da ripa.
      for (let k = 0; k < 6; k++) {
        g.fillStyle = tom(cor, -0.1 - r() * 0.12, 0.35)
        g.fillRect(x + fresta + r() * (ripa - fresta * 2), 0, 0.8 + r() * 1.6, lado)
      }
      g.fillStyle = tom(cor, 0.14, 0.8)
      g.fillRect(x + fresta, 0, 2, lado)
      g.fillStyle = tom(cor, -0.55)
      g.fillRect(x, 0, fresta, lado)
    }
    ruido(8)
  } else {
    ruido(6)
  }
  return canvas
}

const miniaturas = new Map<string, string>()

/** Amostra pequena do papel para os botões do painel. */
export function miniaturaPapel(tipo: TipoPapel, cor: string) {
  const chave = `${tipo}${cor}`
  if (!miniaturas.has(chave)) miniaturas.set(chave, desenharPapel(tipo, cor, 256).toDataURL('image/jpeg', 0.8))
  return miniaturas.get(chave)!
}
