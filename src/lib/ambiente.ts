import { useSyncExternalStore } from 'react'

/** Ponto na planta, em centímetros. x para a direita, y para baixo (como na tela vista de cima). */
export type Ponto = { x: number; y: number }
export type Canto = Ponto & { raio: number }
export type Porta = { id: string; parede: number; /** Centro da porta ao longo da parede, de 0 a 1. */ t: number; largura: number }

export type Planta = { formato: Formato; cantos: Canto[]; portas: Porta[]; peDireito: number }

export type Item = {
  id: string
  slug: string
  cor: number
  /** Centro do móvel, em cm. Null até a cena 3D achar um lugar livre para ele. */
  x: number | null
  y: number | null
  /** Giro em graus, no sentido horário visto de cima. */
  giro: number
  /** Altura da base em relação ao chão, em cm (decoração em cima de uma mesa, por exemplo). */
  elevacao?: number
}

export type Etapa = 'planta' | '3d'
export type Ambiente = { etapa: Etapa; planta: Planta; itens: Item[]; acabamento: Acabamento }

export type TipoPiso = 'madeira' | 'porcelanato' | 'ladrilho' | 'cimento' | 'marmore' | 'carpete'

export type Acabamento = {
  /** Cor de todas as paredes. */
  paredes: string
  /** Cor de cada parede (pelo índice). Null quando todas são iguais. */
  porParede: Record<number, string> | null
  piso: TipoPiso
  corPiso: string
}

export type OpcaoCor = { nome: string; hex: string }

export const coresParede: OpcaoCor[] = [
  { nome: 'Off-white', hex: '#f3eee6' },
  { nome: 'Branco', hex: '#fbfbf8' },
  { nome: 'Areia', hex: '#e6dccb' },
  { nome: 'Fendi', hex: '#cfc3b2' },
  { nome: 'Sálvia', hex: '#b9c4ae' },
  { nome: 'Azul névoa', hex: '#aebcc8' },
  { nome: 'Rosé', hex: '#dfbfb1' },
  { nome: 'Terracota', hex: '#c27a58' },
  { nome: 'Verde musgo', hex: '#5f6b56' },
  { nome: 'Grafite', hex: '#454a52' },
]

export const pisos: { id: TipoPiso; rotulo: string; cores: OpcaoCor[] }[] = [
  {
    id: 'madeira',
    rotulo: 'Madeira',
    cores: [
      { nome: 'Carvalho', hex: '#b98a5a' },
      { nome: 'Clara', hex: '#d6b88e' },
      { nome: 'Freijó', hex: '#8f6843' },
      { nome: 'Cumaru', hex: '#9b5d38' },
      { nome: 'Nogueira', hex: '#5f402c' },
    ],
  },
  {
    id: 'porcelanato',
    rotulo: 'Porcelanato',
    cores: [
      { nome: 'Off-white', hex: '#e8e3da' },
      { nome: 'Areia', hex: '#d3c5af' },
      { nome: 'Cinza', hex: '#a9a8a4' },
      { nome: 'Grafite', hex: '#55575a' },
    ],
  },
  {
    id: 'marmore',
    rotulo: 'Mármore',
    cores: [
      { nome: 'Carrara', hex: '#ece9e4' },
      { nome: 'Travertino', hex: '#d8c6a9' },
      { nome: 'Nero', hex: '#2e2e30' },
    ],
  },
  {
    id: 'ladrilho',
    rotulo: 'Ladrilho',
    cores: [
      { nome: 'Terracota', hex: '#c06b47' },
      { nome: 'Creme', hex: '#e6dfd1' },
      { nome: 'Verde', hex: '#6f8a78' },
      { nome: 'Azul', hex: '#34425a' },
    ],
  },
  {
    id: 'cimento',
    rotulo: 'Cimento queimado',
    cores: [
      { nome: 'Claro', hex: '#c9c4bb' },
      { nome: 'Médio', hex: '#9a968f' },
      { nome: 'Escuro', hex: '#5f5d59' },
    ],
  },
  {
    id: 'carpete',
    rotulo: 'Carpete',
    cores: [
      { nome: 'Bege', hex: '#b3a58f' },
      { nome: 'Cinza', hex: '#8a8780' },
      { nome: 'Azul', hex: '#4a5568' },
      { nome: 'Verde', hex: '#5d6b58' },
    ],
  },
]

const acabamentoPadrao: Acabamento = { paredes: '#f3eee6', porParede: null, piso: 'porcelanato', corPiso: '#d3c5af' }

export const corDaParede = (a: Acabamento, parede: number) => a.porParede?.[parede] ?? a.paredes

export type Formato = 'retangulo' | 'quadrado' | 'l' | 'u' | 't' | 'z' | 'arredondado' | 'corredor'

const retangulo = (l: number, a: number, raio = 0): Canto[] =>
  [
    [0, 0],
    [l, 0],
    [l, a],
    [0, a],
  ].map(([x, y]) => ({ x, y, raio }))

const poligono = (pontos: number[][]): Canto[] => pontos.map(([x, y]) => ({ x, y, raio: 0 }))

export const formatos: { id: Formato; rotulo: string; cantos: () => Canto[] }[] = [
  { id: 'retangulo', rotulo: 'Retângulo', cantos: () => retangulo(600, 450) },
  { id: 'quadrado', rotulo: 'Quadrado', cantos: () => retangulo(450, 450) },
  { id: 'l', rotulo: 'Em L', cantos: () => poligono([[0, 0], [600, 0], [600, 250], [300, 250], [300, 500], [0, 500]]) },
  { id: 'u', rotulo: 'Em U', cantos: () => poligono([[0, 0], [200, 0], [200, 250], [400, 250], [400, 0], [600, 0], [600, 500], [0, 500]]) },
  { id: 't', rotulo: 'Em T', cantos: () => poligono([[0, 0], [700, 0], [700, 250], [470, 250], [470, 550], [230, 550], [230, 250], [0, 250]]) },
  { id: 'z', rotulo: 'Em Z', cantos: () => poligono([[0, 0], [400, 0], [400, 220], [700, 220], [700, 450], [300, 450], [300, 230], [0, 230]]) },
  { id: 'arredondado', rotulo: 'Arredondado', cantos: () => retangulo(600, 450, 120) },
  { id: 'corredor', rotulo: 'Corredor', cantos: () => retangulo(900, 200) },
]

export const PE_DIREITO = { min: 220, max: 500, passo: 10 }
export const RAIO_CANTO = 100
export const LARGURA_PORTA = 80
/** Espaço em volta de cada móvel para circular e usar. */
export const AREA_USO = 50

const novaPlanta = (formato: Formato = 'retangulo', peDireito = 280): Planta => ({
  formato,
  cantos: formatos.find((f) => f.id === formato)!.cantos(),
  portas: [],
  peDireito,
})

// --- Geometria ---------------------------------------------------------------

export const sub = (a: Ponto, b: Ponto): Ponto => ({ x: a.x - b.x, y: a.y - b.y })
export const soma = (a: Ponto, b: Ponto): Ponto => ({ x: a.x + b.x, y: a.y + b.y })
export const escalar = (a: Ponto, k: number): Ponto => ({ x: a.x * k, y: a.y * k })
export const comprimento = (a: Ponto) => Math.hypot(a.x, a.y)
const unitario = (a: Ponto) => escalar(a, 1 / (comprimento(a) || 1))
const produto = (a: Ponto, b: Ponto) => a.x * b.x + a.y * b.y

const areaComSinal = (pts: Ponto[]) =>
  pts.reduce((s, p, i) => {
    const q = pts[(i + 1) % pts.length]
    return s + p.x * q.y - q.x * p.y
  }, 0) / 2

export const area = (pts: Ponto[]) => Math.abs(areaComSinal(pts))

export type Parede = {
  a: Ponto
  b: Ponto
  /** Trecho reto, entre os arredondamentos dos cantos. */
  inicio: Ponto
  fim: Ponto
  /** Normal para fora do cômodo. */
  normal: Ponto
  comprimento: number
}

export type Geometria = {
  /** Contorno do piso, já com os cantos arredondados. */
  contorno: Ponto[]
  paredes: Parede[]
  /** Arcos dos cantos arredondados, como sequência de pontos. */
  arcos: Ponto[][]
  /** Canto de cada arco (o arco fica entre a parede anterior e a parede com este índice). */
  cantosArco: number[]
  /** Sinal da orientação, para achar a normal externa de qualquer trecho. */
  sentido: 1 | -1
}

/** Normal externa de um trecho a→b do contorno. */
export const normalExterna = (a: Ponto, b: Ponto, sentido: 1 | -1): Ponto => {
  const d = unitario(sub(b, a))
  return sentido > 0 ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x }
}

export function geometria(cantos: Canto[]): Geometria {
  const n = cantos.length
  const sentido = areaComSinal(cantos) > 0 ? 1 : -1
  // Ponto onde o arredondamento encosta em cada lado do canto.
  const tangentes = cantos.map((c, i) => {
    const ant = cantos[(i - 1 + n) % n]
    const prox = cantos[(i + 1) % n]
    if (!c.raio) return { entra: { x: c.x, y: c.y }, sai: { x: c.x, y: c.y }, arco: [] as Ponto[] }
    const u1 = unitario(sub(ant, c))
    const u2 = unitario(sub(prox, c))
    const theta = Math.acos(Math.max(-1, Math.min(1, produto(u1, u2))))
    if (theta < 0.01 || theta > Math.PI - 0.01) return { entra: { x: c.x, y: c.y }, sai: { x: c.x, y: c.y }, arco: [] }
    const maxD = Math.min(comprimento(sub(ant, c)), comprimento(sub(prox, c))) / 2
    const d = Math.min(c.raio / Math.tan(theta / 2), maxD)
    const r = d * Math.tan(theta / 2)
    const entra = soma(c, escalar(u1, d))
    const sai = soma(c, escalar(u2, d))
    const centro = soma(c, escalar(unitario(soma(u1, u2)), r / Math.sin(theta / 2)))
    const a1 = Math.atan2(entra.y - centro.y, entra.x - centro.x)
    let delta = Math.atan2(sai.y - centro.y, sai.x - centro.x) - a1
    while (delta > Math.PI) delta -= 2 * Math.PI
    while (delta < -Math.PI) delta += 2 * Math.PI
    const passos = 12
    const arco = Array.from({ length: passos + 1 }, (_, k) => {
      const ang = a1 + (delta * k) / passos
      return { x: centro.x + r * Math.cos(ang), y: centro.y + r * Math.sin(ang) }
    })
    return { entra, sai, arco }
  })

  const contorno: Ponto[] = []
  tangentes.forEach((t) => contorno.push(...(t.arco.length ? t.arco : [t.entra])))

  const paredes = cantos.map((a, i) => {
    const b = cantos[(i + 1) % n]
    return {
      a,
      b,
      inicio: tangentes[i].sai,
      fim: tangentes[(i + 1) % n].entra,
      normal: normalExterna(a, b, sentido),
      comprimento: comprimento(sub(b, a)),
    }
  })

  const cantosArco = tangentes.flatMap((t, i) => (t.arco.length ? [i] : []))
  return { contorno, paredes, arcos: cantosArco.map((i) => tangentes[i].arco), cantosArco, sentido }
}

export const caixa = (pts: Ponto[]) => {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, largura: Math.max(...xs) - minX, altura: Math.max(...ys) - minY }
}

export const dentro = (p: Ponto, pts: Ponto[]) => {
  let ok = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) ok = !ok
  }
  return ok
}

const cruzam = (p1: Ponto, p2: Ponto, p3: Ponto, p4: Ponto) => {
  const d = (a: Ponto, b: Ponto, c: Ponto) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = d(p3, p4, p1)
  const d2 = d(p3, p4, p2)
  const d3 = d(p1, p2, p3)
  const d4 = d(p1, p2, p4)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** Ponto da parede (entre `inicio` e `fim`) para uma porta centrada em `t`. */
export const pontoNaParede = (p: Parede, t: number) => soma(p.a, escalar(sub(p.b, p.a), t))

/** Limita o centro da porta ao trecho reto da parede. */
export const limitarPorta = (p: Parede, t: number, largura: number) => {
  if (!p.comprimento) return 0.5
  const ini = comprimento(sub(p.inicio, p.a)) / p.comprimento
  const fim = comprimento(sub(p.fim, p.a)) / p.comprimento
  const meia = largura / 2 / p.comprimento
  if (fim - ini < 2 * meia) return (ini + fim) / 2
  return Math.min(fim - meia, Math.max(ini + meia, t))
}

// --- Encaixe dos móveis ------------------------------------------------------

/** Retângulo ocupado por um móvel no chão: centro, meia largura/profundidade e giro (graus, horário). */
export type Pegada = {
  x: number
  y: number
  meiaL: number
  meiaP: number
  giro: number
  /** Altura da base e do topo, em cm. */
  base: number
  topo: number
}
export type Situacao = 'livre' | 'apertado' | 'naoCabe'

export const vertices = ({ x, y, meiaL, meiaP, giro }: Pegada, folga = 0): Ponto[] => {
  const r = (giro * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const l = meiaL + folga
  const p = meiaP + folga
  return [
    [-l, -p],
    [l, -p],
    [l, p],
    [-l, p],
  ].map(([dx, dy]) => ({ x: x + dx * c - dy * s, y: y + dx * s + dy * c }))
}

/** O ponto cai dentro do retângulo do móvel, visto de cima. */
export const dentroDaPegada = (p: Ponto, { x, y, meiaL, meiaP, giro }: Pegada) => {
  const r = (giro * Math.PI) / 180
  const dx = p.x - x
  const dy = p.y - y
  return Math.abs(dx * Math.cos(r) + dy * Math.sin(r)) <= meiaL && Math.abs(-dx * Math.sin(r) + dy * Math.cos(r)) <= meiaP
}

/** Os dois móveis ocupam a mesma faixa de altura (um em cima do outro não conta). */
const mesmaAltura = (a: Pegada, b: Pegada) => a.base < b.topo - 1 && b.base < a.topo - 1

/** Teste de eixos separadores entre dois polígonos convexos. */
const sobrepoem = (a: Ponto[], b: Ponto[]) => {
  for (const pol of [a, b]) {
    for (let i = 0; i < pol.length; i++) {
      const e = sub(pol[(i + 1) % pol.length], pol[i])
      const eixo = { x: -e.y, y: e.x }
      const pa = a.map((p) => produto(p, eixo))
      const pb = b.map((p) => produto(p, eixo))
      if (Math.max(...pa) <= Math.min(...pb) + 0.01 || Math.max(...pb) <= Math.min(...pa) + 0.01) return false
    }
  }
  return true
}

const cabeNoComodo = (ret: Ponto[], contorno: Ponto[]) =>
  ret.every((p) => dentro(p, contorno)) &&
  !ret.some((p, i) => {
    const q = ret[(i + 1) % 4]
    return contorno.some((c, j) => cruzam(p, q, c, contorno[(j + 1) % contorno.length]))
  })

/** O móvel fica todo do lado de dentro das paredes. */
export const cabeNasParedes = (alvo: Pegada, geo: Geometria) => cabeNoComodo(vertices(alvo), geo.contorno)

/** Área livre que cada porta precisa, do lado de dentro. */
export const areasPortas = (planta: Planta, geo: Geometria) =>
  planta.portas.flatMap((porta) => {
    const parede = geo.paredes[porta.parede]
    if (!parede) return []
    const centro = pontoNaParede(parede, porta.t)
    const ao = unitario(sub(parede.b, parede.a))
    const dentroN = escalar(parede.normal, -1)
    const meia = escalar(ao, porta.largura / 2)
    const fundo = escalar(dentroN, porta.largura)
    return [[sub(centro, meia), soma(centro, meia), soma(soma(centro, meia), fundo), soma(sub(centro, meia), fundo)]]
  })

export function situacao(alvo: Pegada, outras: Pegada[], geo: Geometria, portas: Ponto[][]): Situacao {
  const ret = vertices(alvo)
  const vizinhas = outras.filter((o) => mesmaAltura(alvo, o))
  if (!cabeNoComodo(ret, geo.contorno) || vizinhas.some((o) => sobrepoem(ret, vertices(o)))) return 'naoCabe'
  // Em cima de outro móvel não precisa de espaço para circular.
  if (alvo.base > 0) return 'livre'
  const comFolga = vertices(alvo, AREA_USO)
  if (
    !cabeNoComodo(comFolga, geo.contorno) ||
    vizinhas.some((o) => sobrepoem(comFolga, vertices(o))) ||
    portas.some((p) => sobrepoem(ret, p))
  )
    return 'apertado'
  return 'livre'
}

export const rotulosSituacao: Record<Situacao, string> = {
  livre: 'Espaço livre',
  apertado: `Menos de ${AREA_USO} cm`,
  naoCabe: 'Não cabe',
}
export const coresSituacao: Record<Situacao, string> = { livre: '#3f9d5c', apertado: '#e08a2c', naoCabe: '#d23f3f' }

// --- Estado ------------------------------------------------------------------

const CHAVE = 'ambiente'
const id = () => Math.random().toString(36).slice(2, 10)

const ler = (): Ambiente => {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Ambiente | null
    if ((salvo?.planta?.cantos?.length ?? 0) >= 3 && salvo && Array.isArray(salvo.itens))
      return { ...salvo, acabamento: { ...acabamentoPadrao, ...salvo.acabamento } }
  } catch {
    // Sem acesso ao armazenamento (aba anônima, prévia): começa do zero.
  }
  return { etapa: 'planta', planta: novaPlanta(), itens: [], acabamento: acabamentoPadrao }
}

let estado = ler()
const ouvintes = new Set<() => void>()
/** Desfazer separado por etapa: a planta e os móveis. */
const historico: Record<Etapa, Ambiente[]> = { planta: [], '3d': [] }

const salvar = () => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
  } catch {
    // idem
  }
}

function definir(novo: Ambiente, desfazivel?: Etapa) {
  if (desfazivel) {
    historico[desfazivel].push(estado)
    if (historico[desfazivel].length > 60) historico[desfazivel].shift()
  }
  estado = novo
  salvar()
  ouvintes.forEach((fn) => fn())
}

export const useAmbiente = () =>
  useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn)
      return () => ouvintes.delete(fn)
    },
    () => estado,
  )

export const lerAmbiente = () => estado

export const podeDesfazer = (etapa: Etapa) => historico[etapa].length > 0

export function desfazer(etapa: Etapa) {
  const anterior = historico[etapa].pop()
  if (!anterior) return
  // Desfazer na planta não mexe nos móveis, e vice-versa.
  definir(
    etapa === 'planta'
      ? { ...estado, planta: anterior.planta }
      : { ...estado, itens: anterior.itens, acabamento: anterior.acabamento },
  )
}

export const irPara = (etapa: Etapa) => definir({ ...estado, etapa })

/** Troca a planta. `desfazivel: false` durante o arraste, para o desfazer guardar só o estado de antes. */
export const definirPlanta = (planta: Planta, desfazivel = true) =>
  definir({ ...estado, planta }, desfazivel ? 'planta' : undefined)

export function escolherFormato(formato: Formato) {
  historico.planta.push(estado)
  // As paredes mudam de número: as cores individuais deixam de valer.
  const { acabamento } = estado
  definir({
    ...estado,
    planta: novaPlanta(formato, estado.planta.peDireito),
    acabamento: { ...acabamento, porParede: acabamento.porParede && {} },
  })
}

/** Cores das paredes e o piso. `desfazivel: false` enquanto o seletor de cor livre está sendo arrastado. */
export const definirAcabamento = (mudanca: Partial<Acabamento>, desfazivel = true) =>
  definir({ ...estado, acabamento: { ...estado.acabamento, ...mudanca } }, desfazivel ? '3d' : undefined)

/** Guarda o estado atual no desfazer da planta antes de um arraste. */
export const marcarDesfazer = (etapa: Etapa) => {
  historico[etapa].push(estado)
}

export function adicionarItem(slug: string, cor: number) {
  definir({ ...estado, itens: [...estado.itens, { id: id(), slug, cor, x: null, y: null, giro: 0 }] }, '3d')
}

export function atualizarItem(itemId: string, mudanca: Partial<Item>, desfazivel = true) {
  definir(
    { ...estado, itens: estado.itens.map((i) => (i.id === itemId ? { ...i, ...mudanca } : i)) },
    desfazivel ? '3d' : undefined,
  )
}

/** Várias mudanças num único passo do desfazer (ex.: mesa arrastada com a decoração em cima). */
export function atualizarItens(mudancas: Record<string, Partial<Item>>, desfazivel = true) {
  definir(
    { ...estado, itens: estado.itens.map((i) => (mudancas[i.id] ? { ...i, ...mudancas[i.id] } : i)) },
    desfazivel ? '3d' : undefined,
  )
}

export function duplicarItem(itemId: string) {
  const item = estado.itens.find((i) => i.id === itemId)
  if (!item) return
  const copia = { ...item, id: id(), x: null, y: null }
  definir({ ...estado, itens: [...estado.itens, copia] }, '3d')
  return copia.id
}

export const removerItem = (itemId: string) =>
  definir({ ...estado, itens: estado.itens.filter((i) => i.id !== itemId) }, '3d')

export const novoIdPorta = id

/** "1 móvel escolhido", "3 móveis escolhidos". */
export const contarMoveis = (n: number) => `${n} ${n === 1 ? 'móvel escolhido' : 'móveis escolhidos'}`

export const metros = (cm: number, casas = 2) =>
  (cm / 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
