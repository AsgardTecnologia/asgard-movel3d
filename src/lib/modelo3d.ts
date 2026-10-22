import type { ModelViewerElement } from '@google/model-viewer'
import type { Cor, Gaveta, Modelo3D } from '../data/moveis'

type Material = NonNullable<ReturnType<NonNullable<ModelViewerElement['model']>['getMaterialByName']>>
type Textura = Material['pbrMetallicRoughness']['baseColorTexture']['texture']
type RGBA = [number, number, number, number]

const originais = new WeakMap<Material, { textura: Textura; fator: RGBA }>()

/** Aplica a cor escolhida nos materiais configurados do modelo. A primeira cor do móvel restaura o original. */
export function aplicarCor(mv: ModelViewerElement, modelo: Modelo3D, cor: Cor, original: boolean) {
  if (!mv.model) return

  for (const nome of modelo.materiais) {
    const material = mv.model.getMaterialByName(nome)
    if (!material) continue

    const pbr = material.pbrMetallicRoughness
    let base = originais.get(material)
    if (!base) {
      base = { textura: pbr.baseColorTexture.texture, fator: [...pbr.baseColorFactor] as RGBA }
      originais.set(material, base)
    }

    if (original) {
      pbr.baseColorTexture.setTexture(base.textura)
      pbr.setBaseColorFactor(base.fator)
    } else {
      // 'tingir' mantém o veio da madeira; 'trocar' tira a textura de cor e mantém o relevo (normal map).
      pbr.baseColorTexture.setTexture(modelo.modo === 'tingir' ? base.textura : null)
      pbr.setBaseColorFactor(cor.fator ?? cor.hex)
    }
  }
}

/** Pinta cada material pelo nome, mantendo a textura (ex.: combinação de roupa de cama). */
export function aplicarMateriais(mv: ModelViewerElement, cores: Record<string, string>) {
  if (!mv.model) return
  for (const [nome, hex] of Object.entries(cores)) {
    mv.model.getMaterialByName(nome)?.pbrMetallicRoughness.setBaseColorFactor(hex)
  }
}

type No3D ={ name: string; parent: No3D | null; position: { z: number }; rotation: { x: number } }
/** Partes internas do model-viewer usadas para mexer nas gavetas (não fazem parte da API pública). */
type Cena = {
  getNDC(x: number, y: number): unknown
  hitFromPoint(ndc: unknown): { object: No3D } | null
  getObjectByName(nome: string): No3D | undefined
  queueRender(): void
  queueShadowRender(): void
}

const cenaDo = (mv: ModelViewerElement) => {
  const simbolo = Object.getOwnPropertySymbols(mv).find((s) => s.description === 'scene')
  return simbolo ? ((mv as unknown as Record<symbol, Cena>)[simbolo] ?? null) : null
}

const animando = new Map<string, number>()

const ler = (no: No3D, gaveta: Gaveta) => (gaveta.giro ? no.rotation.x : no.position.z)
const aberta = (no: No3D, gaveta: Gaveta) => ler(no, gaveta) / gaveta.curso > 0.5

/** Anima uma gaveta (ou assento/encosto) até aberta ou fechada; sem `abrir`, inverte o estado atual. */
function mover(cena: Cena, gaveta: Gaveta, abrir?: boolean) {
  const no = cena.getObjectByName(gaveta.no)
  if (!no) return
  const corredica = gaveta.corredica ? cena.getObjectByName(gaveta.corredica) : undefined
  const de = ler(no, gaveta)
  const para = (abrir ?? !aberta(no, gaveta)) ? gaveta.curso : 0
  const duracao = (gaveta.giro ? 700 : 450) * (Math.abs(para - de) / Math.abs(gaveta.curso))
  const t0 = performance.now()
  cancelAnimationFrame(animando.get(gaveta.no) ?? 0)

  const passo = (agora: number) => {
    const t = duracao ? Math.min(1, (agora - t0) / duracao) : 1
    const suave = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    const valor = de + (para - de) * suave
    if (gaveta.giro) no.rotation.x = valor
    else no.position.z = valor
    if (corredica) corredica.position.z = valor / 2
    cena.queueRender()
    cena.queueShadowRender()
    if (t < 1) animando.set(gaveta.no, requestAnimationFrame(passo))
    else animando.delete(gaveta.no)
  }
  animando.set(gaveta.no, requestAnimationFrame(passo))
}

/** Abre todas as partes móveis, ou fecha todas se alguma já estiver aberta. */
export function alternarGavetas(mv: ModelViewerElement, gavetas: Gaveta[]) {
  const cena = cenaDo(mv)
  if (!cena) return
  const algumaAberta = gavetas.some((g) => {
    const no = cena.getObjectByName(g.no)
    return no ? aberta(no, g) : false
  })
  gavetas.forEach((g) => mover(cena, g, !algumaAberta))
}

/** Toque (sem arrastar) numa gaveta do modelo abre ou fecha a gaveta. Devolve a função que desliga. */
export function ativarGavetas(mv: ModelViewerElement, gavetas: Gaveta[]) {
  let inicio: { x: number; y: number } | null = null

  const aoPressionar = (e: PointerEvent) => {
    inicio = { x: e.clientX, y: e.clientY }
  }
  const aoSoltar = (e: PointerEvent) => {
    if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 6) return
    inicio = null
    const cena = cenaDo(mv)
    const acerto = cena?.hitFromPoint(cena.getNDC(e.clientX, e.clientY))
    for (let no = acerto?.object ?? null; no; no = no.parent) {
      const gaveta = gavetas.find((g) => g.no === no!.name)
      if (gaveta) return mover(cena!, gaveta)
    }
  }

  mv.addEventListener('pointerdown', aoPressionar)
  mv.addEventListener('pointerup', aoSoltar)
  return () => {
    mv.removeEventListener('pointerdown', aoPressionar)
    mv.removeEventListener('pointerup', aoSoltar)
    animando.forEach((id) => cancelAnimationFrame(id))
  }
}
