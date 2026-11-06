import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { buscarMovel, type Movel } from '../data/moveis'
import { buscarPeca, type Peca } from '../data/pecas'
import { criarPeca, descartarPeca } from './pecas3d'
import { textura } from './texturas'
import { asperezaPiso, desenharPiso, tamanhoPiso } from './texturasPiso'
import { desenharPapel, tamanhoPapel } from './texturasParede'
import {
  ALTURA_PORTA,
  alturaDaParede,
  coresPorta,
  papelDaParede,
  AREA_USO,
  areasPortas,
  cabeNasParedes,
  caixa,
  dentro,
  dentroDaPegada,
  escalar,
  geometria,
  normalExterna,
  pontoNaParede,
  situacao,
  coresSituacao,
  corDaParede,
  soma,
  sub,
  comprimento,
  type Acabamento,
  type Geometria,
  type Item,
  type Pegada,
  type Planta,
  type Ponto,
  type Situacao,
} from './ambiente'

/** A cena trabalha em metros; a planta, em centímetros. */
const M = 0.01
const ESPESSURA = 12
const RODAPE = 12
/** Recuo da calçada em volta da casa, na fachada (cm). */
const CALCADA = 160
const FUNDO = '#e4ddd2'
const CEU = '#dfe5e2'

/** '3d': casa de bonecas vista de cima. 'dentro': na altura dos olhos, como quem está no cômodo. */
export type Modo = '3d' | 'planta' | 'dentro'

/** Altura dos olhos na vista de dentro (cm). */
const OLHOS = 160
/** Distância mínima da câmera às paredes ao andar (cm). */
const FOLGA_ANDAR = 25

/** Céu (em cima), horizonte e chão lá fora, visto pelas janelas na vista de dentro. */
function criarCeu() {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#8fb3d6')
  grad.addColorStop(0.42, '#d7e3ea')
  grad.addColorStop(0.5, '#eef0ea')
  grad.addColorStop(0.53, '#b9bf9f')
  grad.addColorStop(1, '#7f8d63')
  g.fillStyle = grad
  g.fillRect(0, 0, 16, 256)
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Celular e tablet: sem oclusão de ambiente, para não pesar. */
const leve = () => window.matchMedia('(pointer: coarse)').matches

type Callbacks = {
  aoSelecionar: (id: string | null) => void
  /** Fim de um arraste: grava as novas posições (com desfazer), inclusive do que estava em cima do móvel. */
  aoMover: (mudancas: Record<string, { x: number; y: number; elevacao: number }>) => void
  /** Lugar livre encontrado para um móvel recém-adicionado (sem desfazer). */
  aoPosicionar: (id: string, x: number, y: number) => void
  aoSituacoes: (s: Record<string, Situacao>) => void
  /** Toque (sem arrastar) numa parede. */
  aoTocarParede: (parede: number) => void
  /** Toque (sem arrastar) no piso. */
  aoTocarPiso?: () => void
}

type Objeto = {
  item: Item
  /** Móvel do catálogo (.glb) ou peça de ambientação (montada no 3D). */
  movel: Movel | null
  peca: Peca | null
  /** Medidas e cores com que a peça foi montada: mudou, monta de novo. */
  assinatura: string
  /** Termina quando o modelo está na cena (para fotografar o ambiente pronto). */
  carga: Promise<void>
  grupo: THREE.Group
  modelo: THREE.Object3D | null
  /** Caixa invisível do tamanho do móvel: o toque testa nela, não nas milhares de faces do modelo. */
  toque: THREE.Mesh | null
  meia: { l: number; p: number } | null
  altura: number
  piso: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  borda: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>
  folga: THREE.LineLoop<THREE.BufferGeometry, THREE.LineDashedMaterial>
}

type TrechoParede = {
  malha: THREE.Mesh
  parede: number
  normal: THREE.Vector2
  centro: THREE.Vector2
  altura: number
  verga: boolean
}

/** Batentes, folhas e caixilhos: somem junto com a verga quando a parede abaixa. */
type Detalhe = { obj: THREE.Object3D; normal: THREE.Vector2; centro: THREE.Vector2 }

/** Contorno afastado `d` cm para fora (beiral da laje, calçada). */
function expandir(pts: Ponto[], d: number, sentido: 1 | -1): Ponto[] {
  const n = pts.length
  return pts.map((p, i) => {
    const n1 = normalExterna(pts[(i - 1 + n) % n], p, sentido)
    const n2 = normalExterna(p, pts[(i + 1) % n], sentido)
    const k = 1 + n1.x * n2.x + n1.y * n2.y
    if (k < 0.2) return soma(p, escalar(n2, d))
    return soma(p, escalar({ x: n1.x + n2.x, y: n1.y + n2.y }, d / k))
  })
}

const formaDe = (pts: Ponto[]) => new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * M, -p.y * M)))

const materialVidro = new THREE.MeshPhysicalMaterial({
  color: '#cfe2e6',
  roughness: 0.04,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
  side: THREE.DoubleSide,
})
const materialPeitoril = new THREE.MeshStandardMaterial({ color: '#e9e5dc', roughness: 0.5 })
const materialMacaneta = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.25, metalness: 0.9 })

// Mesmo decodificador Draco que o model-viewer usa na página do produto.
const carregador = new GLTFLoader()
  .setDRACOLoader(new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'))
  .setMeshoptDecoder(MeshoptDecoder)
const cacheModelos = new Map<string, Promise<GLTF>>()
const carregar = (src: string) => {
  if (!cacheModelos.has(src)) cacheModelos.set(src, carregador.loadAsync(src))
  return cacheModelos.get(src)!
}

type Original = { cor: THREE.Color; mapa: THREE.Texture | null }

/** Mesma regra do visualizador do produto: 'tingir' mantém a textura, 'trocar' substitui a cor. */
function aplicarCor(modelo: THREE.Object3D, movel: Movel, indice: number) {
  const config = movel.modelo!
  const cor = movel.cores[indice] ?? movel.cores[0]
  modelo.traverse((o) => {
    const malha = o as THREE.Mesh
    if (!malha.isMesh) return
    for (const m of [malha.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!config.materiais.includes(m.name) || !m.color) continue
      const original = (m.userData.original ??= { cor: m.color.clone(), mapa: m.map } as Original) as Original
      if (indice === 0) {
        m.color.copy(original.cor)
        m.map = original.mapa
      } else {
        m.color.set(cor.fator ?? cor.hex)
        m.map = config.modo === 'tingir' ? original.mapa : null
      }
      m.needsUpdate = true
    }
  })
}

/**
 * UV em metros (em vez de 0 a 1 por face), para o papel de parede sair em tamanho real em qualquer trecho.
 * `base` sobe o desenho dos trechos acima das portas, para emendar com o resto da parede.
 */
function uvEmMetros(caixa: THREE.BoxGeometry, l: number, h: number, e: number, base: number) {
  const uv = caixa.getAttribute('uv')
  // Faces da BoxGeometry, 4 vértices cada: +x, -x, +y, -y, +z, -z.
  const faces = [
    [e, h, base],
    [e, h, base],
    [l, e, 0],
    [l, e, 0],
    [l, h, base],
    [l, h, base],
  ]
  faces.forEach(([su, sv, dv], f) => {
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv + dv)
  })
}

const retangulo = (l: number, p: number) =>
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-l, 0, -p),
    new THREE.Vector3(l, 0, -p),
    new THREE.Vector3(l, 0, p),
    new THREE.Vector3(-l, 0, p),
  ])

export class CenaAmbiente {
  private renderer: THREE.WebGLRenderer
  private cena = new THREE.Scene()
  private camera3d = new THREE.PerspectiveCamera(40, 1, 0.05, 200)
  private cameraPlanta = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200)
  private controles3d: OrbitControls
  private controlesPlanta: OrbitControls
  private cameraDentro = new THREE.PerspectiveCamera(70, 1, 0.03, 200)
  private controlesDentro: OrbitControls
  /** Para onde a câmera anda na vista de dentro (a cada quadro chega um pouco mais perto). */
  private caminhada: { de: THREE.Vector3; ate: THREE.Vector3 } | null = null
  private teclas = new Set<string>()
  private interior = new THREE.Group()
  private ceu = criarCeu()
  private fundo = new THREE.Color(FUNDO)
  private composer: EffectComposer | null = null
  private passeRender: RenderPass | null = null
  private passeAO: GTAOPass | null = null
  private modo: Modo = '3d'
  private comodo = new THREE.Group()
  private trechos: TrechoParede[] = []
  private detalhes: Detalhe[] = []
  private malhaPiso: THREE.Mesh | null = null
  private materialEsquadria = new THREE.MeshStandardMaterial({ color: '#232325', roughness: 0.4, metalness: 0.3 })
  private materialPorta = new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.55 })
  private materialLaje = new THREE.MeshStandardMaterial({ color: '#ecebe7', roughness: 0.8 })
  private materialGrama = new THREE.MeshStandardMaterial({ map: textura('grama', '#5f7f3e'), roughness: 1 })
  private sol: THREE.DirectionalLight
  private objetos = new Map<string, Objeto>()
  private geo: Geometria | null = null
  private planta: Planta | null = null
  private portas: Ponto[][] = []
  private selecionado: string | null = null
  private mostrarFolga = false
  private situacoes: Record<string, Situacao> = {}
  private raio = new THREE.Raycaster()
  private chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private arraste: {
    id: string
    desvio: THREE.Vector3
    moveu: boolean
    /** Objetos apoiados no móvel arrastado, que vão junto. */
    carona: { o: Objeto; dx: number; dy: number; dz: number }[]
  } | null = null
  private toque: { x: number; y: number } | null = null
  private observador: ResizeObserver
  private materialPiso = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
  private materialTopo = new THREE.MeshStandardMaterial({ color: '#6f675e', roughness: 0.9 })
  private materiaisParede = new Map<number, THREE.MeshStandardMaterial>()
  private texturasPapel = new Map<string, THREE.CanvasTexture>()
  private acabamento: Acabamento | null = null
  private pisoAtual = ''
  private paredeDestacada: number | null = null
  private vivo = true
  private container: HTMLElement
  private rotulo: HTMLElement | null
  private cb: Callbacks

  constructor(container: HTMLElement, rotulo: HTMLElement | null, cb: Callbacks) {
    this.container = container
    this.rotulo = rotulo
    this.cb = cb

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    // Acima de 1,5× a diferença quase não aparece e o custo por pixel dobra.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    // A sombra só é refeita quando algo muda de lugar (ver `marcar`), não a cada quadro.
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    this.cena.background = this.fundo
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.cena.environmentIntensity = 0.5
    pmrem.dispose()

    this.cena.add(new THREE.HemisphereLight('#ffffff', '#cfc5b6', 0.7))
    this.sol = new THREE.DirectionalLight('#fff3e2', 1.6)
    this.sol.castShadow = true
    this.sol.shadow.mapSize.setScalar(2048)
    this.sol.shadow.bias = -0.0004
    this.sol.shadow.normalBias = 0.02
    this.sol.shadow.radius = 4
    this.cena.add(this.sol, this.sol.target, this.comodo)

    // O arraste dos móveis escuta antes dos controles, para desligá-los quando o toque cai num móvel.
    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.aoPressionar)
    el.addEventListener('pointermove', this.aoMoverPonteiro)
    el.addEventListener('pointerup', this.aoSoltar)
    el.addEventListener('pointercancel', this.aoSoltar)

    this.controles3d = new OrbitControls(this.camera3d, el)
    this.controles3d.enableDamping = true
    this.controles3d.maxPolarAngle = Math.PI / 2 - 0.08
    this.controles3d.minDistance = 1
    this.controles3d.maxDistance = 40

    this.cameraPlanta.up.set(0, 0, -1)
    this.controlesPlanta = new OrbitControls(this.cameraPlanta, el)
    this.controlesPlanta.enableRotate = false
    this.controlesPlanta.enableDamping = true
    this.controlesPlanta.screenSpacePanning = true
    this.controlesPlanta.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controlesPlanta.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
    this.controlesPlanta.enabled = false

    // Vista de dentro: a câmera fica parada e gira em volta de si (alvo colado à frente dela).
    this.controlesDentro = new OrbitControls(this.cameraDentro, el)
    this.controlesDentro.enableDamping = true
    this.controlesDentro.dampingFactor = 0.12
    this.controlesDentro.enableZoom = false
    this.controlesDentro.enablePan = false
    this.controlesDentro.rotateSpeed = -0.35
    this.controlesDentro.minPolarAngle = 0.35
    this.controlesDentro.maxPolarAngle = Math.PI - 0.5
    this.controlesDentro.enabled = false
    el.addEventListener('dblclick', this.aoToqueDuplo)
    el.addEventListener('wheel', this.aoRolar, { passive: false })
    window.addEventListener('keydown', this.aoTecla)
    window.addEventListener('keyup', this.aoTecla)

    if (!leve()) {
      // Oclusão de ambiente: sombra suave nos cantos e embaixo dos móveis.
      const alvo = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType })
      this.composer = new EffectComposer(this.renderer, alvo)
      this.passeRender = new RenderPass(this.cena, this.camera3d)
      this.passeAO = new GTAOPass(this.cena, this.camera3d, 1, 1)
      this.passeAO.output = GTAOPass.OUTPUT.Default
      this.passeAO.blendIntensity = 0.9
      this.passeAO.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1 })
      this.passeAO.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 })
      this.composer.addPass(this.passeRender)
      this.composer.addPass(this.passeAO)
      this.composer.addPass(new OutputPass())
    }

    this.observador = new ResizeObserver(() => this.redimensionar())
    this.observador.observe(container)
    this.redimensionar()
    this.renderer.setAnimationLoop(this.quadro)
  }

  // --- Planta ----------------------------------------------------------------

  definirPlanta(planta: Planta) {
    const mudouForma = JSON.stringify(planta) !== JSON.stringify(this.planta)
    if (!mudouForma) return
    const primeira = !this.planta
    this.planta = planta
    this.geo = geometria(planta.cantos)
    this.portas = areasPortas(planta, this.geo)
    this.construirComodo()
    if (primeira) this.centralizar()
    this.atualizarSituacoes()
  }

  private construirComodo() {
    const { geo, planta } = this
    if (!geo || !planta) return
    this.comodo.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) m.geometry.dispose()
    })
    this.comodo.clear()
    this.trechos = []
    this.detalhes = []
    const fachada = !!planta.fachada
    this.fundo.set(fachada || planta.grama ? CEU : FUNDO)
    this.cena.background = this.modo === 'dentro' ? this.ceu : this.fundo

    // Na fachada o piso vira a calçada em volta da casa.
    const contornoPiso = fachada ? expandir(geo.contorno, CALCADA, geo.sentido) : geo.contorno
    const piso = new THREE.Mesh(new THREE.ShapeGeometry(formaDe(contornoPiso)), this.materialPiso)
    piso.rotation.x = -Math.PI / 2
    piso.receiveShadow = true
    this.comodo.add(piso)
    this.malhaPiso = piso

    if (fachada || planta.grama) {
      const c = caixa(geo.contorno)
      const lado = (Math.max(c.largura, c.altura) + 2400) * M
      const grama = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), this.materialGrama)
      grama.geometry.attributes.uv.array.forEach((_, i, uv) => ((uv as Float32Array)[i] *= lado))
      grama.rotation.x = -Math.PI / 2
      grama.position.set((c.x + c.largura / 2) * M, -0.004, (c.y + c.altura / 2) * M)
      grama.receiveShadow = true
      this.comodo.add(grama)
    }

    if (fachada) {
      const laje = new THREE.Mesh(
        new THREE.ExtrudeGeometry(formaDe(expandir(geo.contorno, 45, geo.sentido)), { depth: 0.22, bevelEnabled: false }),
        this.materialLaje,
      )
      laje.rotation.x = -Math.PI / 2
      laje.position.y = planta.peDireito * M
      laje.castShadow = true
      laje.receiveShadow = true
      this.comodo.add(laje)
    }

    const trecho = (
      parede: number,
      a: Ponto,
      b: Ponto,
      normal: Ponto,
      base: number,
      altura: number,
      centro: Ponto,
      verga = false,
    ) => {
      const lado = this.materialParede(parede)
      const materiais = [lado, lado, this.materialTopo, lado, lado, lado]
      const vetor = sub(b, a)
      const l = comprimento(vetor)
      if (l < 1 || altura < 1) return
      // Estende metade da espessura nas pontas para fechar as quinas.
      const caixa = new THREE.BoxGeometry((l + ESPESSURA) * M, altura * M, ESPESSURA * M)
      uvEmMetros(caixa, (l + ESPESSURA) * M, altura * M, ESPESSURA * M, base * M)
      const malha = new THREE.Mesh(caixa, materiais)
      const meio = soma(escalar(soma(a, b), 0.5), escalar(normal, ESPESSURA / 2))
      malha.position.set(meio.x * M, (base + altura / 2) * M, meio.y * M)
      malha.rotation.y = -Math.atan2(vetor.y, vetor.x)
      malha.castShadow = true
      malha.receiveShadow = true
      malha.userData.parede = parede
      this.comodo.add(malha)
      this.trechos.push({
        malha,
        parede,
        normal: new THREE.Vector2(normal.x, normal.y),
        centro: new THREE.Vector2(centro.x * M, centro.y * M),
        altura,
        verga,
      })
    }

    geo.paredes.forEach((p, i) => {
      const h = alturaDaParede(planta, i)
      if (h < 1) return
      const dir = escalar(sub(p.b, p.a), 1 / (p.comprimento || 1))
      const centro = escalar(soma(p.inicio, p.fim), 0.5)
      const distancia = (t: number) => comprimento(sub(pontoNaParede(p, t), p.a))
      // Vãos de portas e janelas desta parede, em cm a partir de `a`.
      const vaos = [
        ...planta.portas
          .filter((pt) => pt.parede === i)
          .map((pt) => ({ c: distancia(pt.t), l: pt.largura, base: 0, topo: Math.min(h, pt.altura ?? ALTURA_PORTA), porta: true })),
        ...planta.janelas
          .filter((j) => j.parede === i)
          .map((j) => ({ c: distancia(j.t), l: j.largura, base: Math.min(j.peitoril, h - 10), topo: Math.min(h, j.peitoril + j.altura), porta: false })),
      ].sort((x, y) => x.c - x.l / 2 - (y.c - y.l / 2))

      let cursor = comprimento(sub(p.inicio, p.a))
      const fim = comprimento(sub(p.fim, p.a))
      const ponto = (d: number) => soma(p.a, escalar(dir, d))
      for (const v of vaos) {
        const de = Math.max(cursor, v.c - v.l / 2)
        const ate = Math.min(fim, v.c + v.l / 2)
        if (ate - de < 10) continue
        trecho(i, ponto(cursor), ponto(de), p.normal, 0, h, centro)
        if (v.base > 0) trecho(i, ponto(de), ponto(ate), p.normal, 0, v.base, centro)
        if (v.topo < h) trecho(i, ponto(de), ponto(ate), p.normal, v.topo, h - v.topo, centro, true)
        this.criarVao(ponto(de), ponto(ate), p.normal, centro, v.base, v.topo, v.porta)
        cursor = ate
      }
      trecho(i, ponto(cursor), ponto(fim), p.normal, 0, h, centro)
    })

    geo.arcos.forEach((arco, j) => {
      const h = alturaDaParede(planta, geo.cantosArco[j])
      for (let k = 0; k < arco.length - 1; k++) {
        const n = normalExterna(arco[k], arco[k + 1], geo.sentido)
        trecho(geo.cantosArco[j], arco[k], arco[k + 1], n, 0, h, escalar(soma(arco[k], arco[k + 1]), 0.5))
      }
    })

    this.construirInterior()

    // Sombra do sol cobrindo o cômodo inteiro.
    const c = caixa(geo.contorno)
    const centro = new THREE.Vector3((c.x + c.largura / 2) * M, 0, (c.y + c.altura / 2) * M)
    const raio = (Math.hypot(c.largura, c.altura) / 2 + (fachada ? CALCADA + 300 : 0)) * M + 1
    this.sol.position.copy(centro).add(new THREE.Vector3(raio * 0.6, raio * 1.6, raio * 0.9))
    this.sol.target.position.copy(centro)
    Object.assign(this.sol.shadow.camera, { left: -raio, right: raio, top: raio, bottom: -raio, far: raio * 5 })
    this.sol.shadow.camera.updateProjectionMatrix()
  }

  /** Teto com spots embutidos e luz quente, só na vista de dentro (de cima, o teto esconderia o cômodo). */
  private construirInterior() {
    const { geo, planta } = this
    if (!geo || !planta) return
    this.interior.clear()
    this.comodo.add(this.interior)
    this.interior.visible = this.modo === 'dentro'
    const h = planta.peDireito * M
    // Área aberta (gourmet com paredes faltando) fica sem teto: o céu aparece por cima.
    const aberto = planta.grama && !planta.fachada
    if (!aberto) {
      const teto = new THREE.Mesh(
        new THREE.ShapeGeometry(formaDe(geo.contorno)),
        new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.95, side: THREE.DoubleSide }),
      )
      teto.rotation.x = -Math.PI / 2
      teto.position.y = h
      teto.receiveShadow = true
      this.interior.add(teto)
    }
    const c = caixa(geo.contorno)
    const passo = 150
    const discos = new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#ffe7bf', emissiveIntensity: 2.2 })
    const luzes: Ponto[] = []
    for (let x = c.x + passo / 2; x < c.x + c.largura; x += passo)
      for (let y = c.y + passo / 2; y < c.y + c.altura; y += passo) if (dentro({ x, y }, geo.contorno)) luzes.push({ x, y })
    if (!aberto)
      for (const p of luzes) {
        const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 24), discos)
        spot.position.set(p.x * M, h - 0.006, p.y * M)
        this.interior.add(spot)
      }
    // Poucas luzes de verdade (cada uma custa): uma a cada ~12 m², até quatro.
    const n = Math.min(2, Math.max(1, Math.round((c.largura * c.altura) / 150000)))
    const escolhidas = luzes.filter((_, i) => i % Math.max(1, Math.floor(luzes.length / n)) === 0).slice(0, n)
    for (const p of escolhidas) {
      const luz = new THREE.PointLight('#ffe2b8', aberto ? 0 : 3, 9, 1.6)
      luz.position.set(p.x * M, h - 0.25, p.y * M)
      this.interior.add(luz)
    }
  }

  /** Porta (batente e folha fechada) ou janela (caixilho, vidro e peitoril) no vão de `a` a `b`. */
  private criarVao(a: Ponto, b: Ponto, normal: Ponto, centro: Ponto, base: number, topo: number, porta: boolean) {
    const vetor = sub(b, a)
    const l = comprimento(vetor) * M
    const h = (topo - base) * M
    const e = ESPESSURA * M
    const g = new THREE.Group()
    const meio = soma(escalar(soma(a, b), 0.5), escalar(normal, ESPESSURA / 2))
    g.position.set(meio.x * M, base * M, meio.y * M)
    g.rotation.y = -Math.atan2(vetor.y, vetor.x)
    const peca = (w: number, alt: number, d: number, mat: THREE.Material, x: number, y: number, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, alt, d), mat)
      m.position.set(x, y + alt / 2, z)
      m.castShadow = mat !== materialVidro
      m.receiveShadow = true
      g.add(m)
      return m
    }
    const perfil = 0.05
    const quadro = porta ? this.materialPorta : this.materialEsquadria
    peca(perfil, h, e + 0.01, quadro, -l / 2 + perfil / 2, 0)
    peca(perfil, h, e + 0.01, quadro, l / 2 - perfil / 2, 0)
    peca(l, perfil, e + 0.01, quadro, 0, h - perfil)
    if (porta) {
      peca(l - perfil * 2, h - perfil, 0.035, this.materialPorta, 0, 0)
      for (const z of [-0.03, 0.03]) peca(0.12, 0.018, 0.018, materialMacaneta, l / 2 - perfil - 0.1, 1.02, z)
    } else {
      if (base > 0) {
        peca(l, perfil, e + 0.01, quadro, 0, 0)
        peca(l + 0.06, 0.025, e + 0.06, materialPeitoril, 0, -0.025)
      }
      // Folhas de correr: uma a cada ~1 m.
      const folhas = Math.max(2, Math.round(l / 1))
      for (let i = 1; i < folhas; i++) peca(0.035, h - perfil, 0.04, quadro, -l / 2 + (l / folhas) * i, 0)
      peca(l - perfil * 2, h - perfil * 2, 0.008, materialVidro, 0, perfil)
    }
    this.comodo.add(g)
    this.detalhes.push({ obj: g, normal: new THREE.Vector2(normal.x, normal.y), centro: new THREE.Vector2(centro.x * M, centro.y * M) })
  }

  // --- Acabamento -------------------------------------------------------------

  private materialParede(parede: number) {
    let m = this.materiaisParede.get(parede)
    if (!m) {
      m = new THREE.MeshStandardMaterial({ roughness: 0.95, emissive: '#c06a3f', emissiveIntensity: 0 })
      this.materiaisParede.set(parede, m)
      this.pintarParede(parede)
    }
    return m
  }

  private pintarParede(parede: number) {
    const m = this.materiaisParede.get(parede)
    if (!m) return
    const cor = this.acabamento ? corDaParede(this.acabamento, parede) : '#f3eee6'
    const papel = this.acabamento ? papelDaParede(this.acabamento, parede) : 'lisa'
    const mapa = papel === 'lisa' ? null : this.texturaPapel(papel, cor)
    // O papel já vem desenhado na cor da parede.
    m.color.set(mapa ? '#ffffff' : cor)
    if (m.map !== mapa) {
      if (!m.map !== !mapa) m.needsUpdate = true
      m.map = mapa
    }
    // Tijolo, ripado e pedra ganham relevo a partir do próprio desenho.
    const relevo = papel === 'tijolinho' || papel === 'ripado' || papel === 'pedra' ? mapa : null
    if (m.bumpMap !== relevo) {
      m.bumpMap = relevo
      m.bumpScale = 2.5
      m.needsUpdate = true
    }
    m.roughness = papel === 'marmore' || papel === 'azulejo' ? 0.35 : 0.92
    m.emissiveIntensity = parede === this.paredeDestacada ? 0.28 : 0
  }

  private texturaPapel(papel: Acabamento['papel'], cor: string) {
    const chave = `${papel}${cor}`
    let t = this.texturasPapel.get(chave)
    if (!t) {
      t = new THREE.CanvasTexture(desenharPapel(papel, cor))
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.setScalar(1 / tamanhoPapel[papel])
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      this.texturasPapel.set(chave, t)
    }
    return t
  }

  definirAcabamento(a: Acabamento) {
    this.marcar()
    this.acabamento = a
    for (const parede of this.materiaisParede.keys()) this.pintarParede(parede)
    // Libera os papéis que nenhuma parede usa mais.
    const emUso = new Set([...this.materiaisParede.values()].map((m) => m.map))
    for (const [chave, t] of this.texturasPapel)
      if (!emUso.has(t)) {
        t.dispose()
        this.texturasPapel.delete(chave)
      }

    this.materialEsquadria.color.set(a.esquadrias)
    const porta = coresPorta.find((c) => c.hex === a.portas)
    const madeira = porta?.textura ? textura(porta.textura, a.portas) : null
    this.materialPorta.color.set(madeira ? '#ffffff' : a.portas)
    if (this.materialPorta.map !== madeira) {
      this.materialPorta.map = madeira
      this.materialPorta.needsUpdate = true
    }

    const piso = `${a.piso}${a.corPiso}`
    if (piso === this.pisoAtual) return
    this.pisoAtual = piso
    const mapaPiso = new THREE.CanvasTexture(desenharPiso(a.piso, a.corPiso))
    mapaPiso.colorSpace = THREE.SRGBColorSpace
    mapaPiso.wrapS = mapaPiso.wrapT = THREE.RepeatWrapping
    mapaPiso.repeat.setScalar(1 / tamanhoPiso[a.piso])
    mapaPiso.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.materialPiso.map?.dispose()
    this.materialPiso.map = mapaPiso
    this.materialPiso.roughness = asperezaPiso[a.piso]
    this.materialPiso.needsUpdate = true
  }

  /** Realça a parede que está sendo pintada. */
  destacarParede(parede: number | null) {
    this.marcar()
    const antes = this.paredeDestacada
    this.paredeDestacada = parede
    if (antes != null) this.pintarParede(antes)
    if (parede != null) this.pintarParede(parede)
  }

  // --- Móveis ----------------------------------------------------------------

  definirItens(itens: Item[]) {
    const ids = new Set(itens.map((i) => i.id))
    for (const [id, o] of this.objetos) {
      if (ids.has(id)) continue
      this.cena.remove(o.grupo)
      this.objetos.delete(id)
      if (this.selecionado === id) this.selecionar(null)
    }

    for (const item of itens) {
      const movel = buscarMovel(item.slug) ?? null
      const peca = movel ? null : (buscarPeca(item.slug) ?? null)
      if (!movel?.modelo && !peca) continue
      let o = this.objetos.get(item.id)
      if (!o) {
        o = this.criarObjeto(item, movel, peca)
        this.objetos.set(item.id, o)
      }
      const corMudou = o.item.cor !== item.cor
      o.item = item
      if (corMudou && o.modelo && movel) aplicarCor(o.modelo, movel, item.cor)
      if (peca && o.assinatura !== assinaturaPeca(item)) this.montarPeca(o, peca)
      const arrastado = this.arraste && (this.arraste.id === item.id || this.arraste.carona.some((c) => c.o === o))
      if (!arrastado && item.x != null && item.y != null) o.grupo.position.set(item.x * M, (item.elevacao ?? 0) * M, item.y * M)
      o.grupo.rotation.y = (-item.giro * Math.PI) / 180
      o.grupo.visible = item.x != null
      // Girar perto da parede (ou encolher o cômodo) pode deixar o móvel atravessando: empurra para dentro.
      if (!arrastado && item.x != null) this.encaixar(o)
    }
    this.atualizarSituacoes()
  }

  private criarObjeto(item: Item, movel: Movel | null, peca: Peca | null): Objeto {
    const grupo = new THREE.Group()
    grupo.userData.id = item.id
    grupo.visible = false
    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }),
    )
    piso.position.y = 0.004
    piso.userData.id = item.id
    const borda = new THREE.LineLoop(retangulo(0.5, 0.5), new THREE.LineBasicMaterial())
    const folga = new THREE.LineLoop(retangulo(0.5, 0.5), new THREE.LineDashedMaterial({ dashSize: 0.08, gapSize: 0.06 }))
    borda.position.y = folga.position.y = 0.006
    grupo.add(piso, borda, folga)
    this.cena.add(grupo)

    const o: Objeto = {
      item,
      movel,
      peca,
      assinatura: '',
      carga: Promise.resolve(),
      grupo,
      modelo: null,
      toque: null,
      meia: null,
      altura: 0,
      piso,
      borda,
      folga,
    }

    if (peca) {
      this.montarPeca(o, peca)
      return o
    }

    o.carga = carregar(movel!.modelo!.src)
      .then((gltf) => {
        if (!this.vivo || this.objetos.get(item.id) !== o) return
        const modelo = gltf.scene.clone(true)
        modelo.traverse((n) => {
          const malha = n as THREE.Mesh
          if (!malha.isMesh) return
          malha.material = Array.isArray(malha.material) ? malha.material.map((m) => m.clone()) : malha.material.clone()
          malha.castShadow = true
          malha.receiveShadow = true
        })
        const box = new THREE.Box3().setFromObject(modelo)
        const tam = box.getSize(new THREE.Vector3())
        const centro = box.getCenter(new THREE.Vector3())
        modelo.position.set(-centro.x, -box.min.y, -centro.z)
        aplicarCor(modelo, movel!, o.item.cor)
        this.instalarModelo(o, modelo, tam)
      })
      .catch(() => {})
    return o
  }

  /** Monta (ou remonta, quando mudam medidas e cores) uma peça de ambientação. */
  private montarPeca(o: Objeto, peca: Peca) {
    const medidas = o.item.medidas ?? peca.medidas
    o.assinatura = assinaturaPeca(o.item)
    if (o.modelo) {
      o.grupo.remove(o.modelo)
      descartarPeca(o.modelo)
    }
    if (o.toque) {
      o.grupo.remove(o.toque)
      o.toque.geometry.dispose()
    }
    const modelo = criarPeca(peca.slug, medidas, o.item.cores)
    this.instalarModelo(o, modelo, new THREE.Vector3(medidas.l * M, Math.max(medidas.a, 2) * M, medidas.p * M))
  }

  /** Põe o modelo no grupo com a caixa de toque, a marcação no chão e um lugar livre, se ainda não tem. */
  private instalarModelo(o: Objeto, modelo: THREE.Object3D, tam: THREE.Vector3) {
    const { grupo, piso, borda, folga, item } = o
    const toque = new THREE.Mesh(new THREE.BoxGeometry(tam.x, tam.y, tam.z), new THREE.MeshBasicMaterial({ visible: false }))
    toque.position.y = tam.y / 2
    toque.userData.id = item.id
    grupo.add(modelo, toque)
    o.modelo = modelo
    o.toque = toque
    o.meia = { l: tam.x / M / 2, p: tam.z / M / 2 }
    o.altura = tam.y

    piso.scale.set(tam.x, 1, tam.z)
    borda.geometry.dispose()
    borda.geometry = retangulo(tam.x / 2, tam.z / 2)
    folga.geometry.dispose()
    folga.geometry = retangulo(tam.x / 2 + AREA_USO * M, tam.z / 2 + AREA_USO * M)
    folga.computeLineDistances()

    if (o.item.x == null || o.item.y == null) {
      const lugar = this.acharLugar(o)
      grupo.position.set(lugar.x * M, (o.item.elevacao ?? 0) * M, lugar.y * M)
      this.cb.aoPosicionar(item.id, lugar.x, lugar.y)
    } else {
      // A peça montada na hora chega aqui antes de `definirItens` posicionar o grupo.
      grupo.position.set(o.item.x * M, (o.item.elevacao ?? 0) * M, o.item.y * M)
      grupo.rotation.y = (-o.item.giro * Math.PI) / 180
      this.encaixar(o)
    }
    grupo.visible = true
    this.atualizarSituacoes()
  }

  private pegada(o: Objeto, x = o.grupo.position.x / M, y = o.grupo.position.z / M): Pegada | null {
    if (!o.meia) return null
    const base = o.grupo.position.y / M
    const rasteira = !!o.peca?.rasteira
    // Peças rasteiras (tapete, deck, piscina) não "batem" nos móveis em cima delas.
    const topo = rasteira ? base + 0.5 : base + o.altura / M
    return { x, y, meiaL: o.meia.l, meiaP: o.meia.p, giro: o.item.giro, base, topo, rasteira }
  }

  /** O móvel cabe entre as paredes em (x, y). Antes de o modelo carregar não há medida para testar. */
  private cabe(o: Objeto, x: number, y: number) {
    const p = this.pegada(o, x, y)
    return !p || !this.geo || !!this.planta?.fachada || cabeNasParedes(p, this.geo)
  }

  /** Anda de `de` em direção a `para` até onde as paredes deixam (`de` precisa caber). */
  private ateAParede(o: Objeto, de: Ponto, para: Ponto): Ponto {
    const ponto = (t: number) => ({ x: de.x + (para.x - de.x) * t, y: de.y + (para.y - de.y) * t })
    if (this.cabe(o, para.x, para.y)) return para
    let [ok, bate] = [0, 1]
    for (let i = 0; i < 14; i++) {
      const t = (ok + bate) / 2
      const p = ponto(t)
      if (this.cabe(o, p.x, p.y)) ok = t
      else bate = t
    }
    return ponto(ok)
  }

  /**
   * Destino do arraste sem atravessar parede: vai em linha reta até encostar e depois desliza
   * rente à parede no eixo que ainda tem espaço. Fora do cômodo (planta encolhida), anda livre.
   */
  private limitar(o: Objeto, de: Ponto, para: Ponto): Ponto {
    if (!this.cabe(o, de.x, de.y)) return para
    let p = this.ateAParede(o, de, para)
    p = this.ateAParede(o, p, { x: para.x, y: p.y })
    return this.ateAParede(o, p, { x: p.x, y: para.y })
  }

  /** Se o móvel atravessa uma parede, leva para o lugar mais próximo onde ele cabe inteiro. */
  private encaixar(o: Objeto) {
    const x = o.grupo.position.x / M
    const y = o.grupo.position.z / M
    if (this.cabe(o, x, y)) return
    const mover = (p: Ponto) => {
      o.grupo.position.x = p.x * M
      o.grupo.position.z = p.y * M
      this.cb.aoPosicionar(o.item.id, p.x, p.y)
    }
    // Começa de 1 cm: o arraste para rente à parede e o arredondamento ao salvar pode passar um pouquinho.
    for (let r = 1; r <= 150; r += r < 5 ? 1 : 5) {
      const passos = Math.max(8, Math.round((2 * Math.PI * r) / 5))
      for (let i = 0; i < passos; i++) {
        const a = (i / passos) * 2 * Math.PI
        const p = { x: Math.round(x + Math.cos(a) * r), y: Math.round(y + Math.sin(a) * r) }
        if (this.cabe(o, p.x, p.y)) return mover(p)
      }
    }
    // Longe demais do cômodo: procura um lugar do zero.
    const lugar = this.acharLugar(o)
    if (this.cabe(o, lugar.x, lugar.y)) mover(lugar)
  }

  /** Altura (cm) onde o móvel fica se for solto em (x, y): no tampo do apoio mais alto embaixo dele, ou no chão. */
  private alturaDeApoio(o: Objeto, x: number, y: number, ignorar: Objeto[]) {
    const minha = o.meia ? o.meia.l * o.meia.p : 0
    let altura = 0
    for (const apoio of this.objetos.values()) {
      const serveDeApoio = apoio.movel?.modelo?.apoio || apoio.peca?.apoio
      if (apoio === o || ignorar.includes(apoio) || !serveDeApoio || !apoio.grupo.visible) continue
      const p = this.pegada(apoio)
      // Só apoia o que é menor que o tampo (uma mesa não sobe em cima de uma mesinha).
      if (p && p.meiaL * p.meiaP > minha && dentroDaPegada({ x, y }, p)) altura = Math.max(altura, p.topo)
    }
    return altura
  }

  /** Procura, a partir do centro do cômodo, o primeiro lugar onde o móvel cabe com folga. */
  private acharLugar(o: Objeto): Ponto {
    const geo = this.geo!
    const c = caixa(geo.contorno)
    const centro = { x: c.x + c.largura / 2, y: c.y + c.altura / 2 }
    const outras = this.pegadasExceto(o.item.id)
    const candidatos: Ponto[] = []
    // Na fachada, as peças vão do lado de fora da casa.
    const fora = !!this.planta?.fachada
    const m = fora ? CALCADA + 200 : 0
    for (let x = c.x - m; x <= c.x + c.largura + m; x += 15)
      for (let y = c.y - m; y <= c.y + c.altura + m; y += 15)
        if (dentro({ x, y }, geo.contorno) !== fora) candidatos.push({ x, y })
    candidatos.sort((a, b) => comprimento(sub(a, centro)) - comprimento(sub(b, centro)))
    let apertado: Ponto | null = null
    for (const p of candidatos) {
      const s = situacao(this.pegada(o, p.x, p.y)!, outras, geo, this.portas, fora)
      if (s === 'livre') return p
      if (s === 'apertado') apertado ??= p
    }
    return apertado ?? candidatos[0] ?? centro
  }

  private pegadasExceto(id: string) {
    return [...this.objetos.values()]
      .filter((o) => o.item.id !== id && o.grupo.visible)
      .map((o) => this.pegada(o))
      .filter((p): p is Pegada => !!p)
  }

  private atualizarSituacoes() {
    // Toda mudança nos móveis e na planta passa por aqui: redesenha e refaz a sombra.
    this.marcar(true)
    if (!this.geo) return
    const novas: Record<string, Situacao> = {}
    for (const o of this.objetos.values()) {
      const p = this.pegada(o)
      if (!p || !o.grupo.visible) continue
      const s = situacao(p, this.pegadasExceto(o.item.id), this.geo, this.portas, !!this.planta?.fachada)
      novas[o.item.id] = s
      const cor = new THREE.Color(coresSituacao[s])
      const ativo = o.item.id === this.selecionado
      // A marcação no chão só aparece no móvel escolhido ou com a área de uso ligada (o ambiente pronto fica limpo).
      const marcar = ativo || this.mostrarFolga
      o.piso.material.color.copy(cor)
      o.piso.material.opacity = marcar ? (ativo ? 0.38 : 0.2) : 0
      o.borda.visible = marcar
      o.borda.material.color.copy(cor)
      o.folga.material.color.copy(cor)
      o.folga.visible = marcar && p.base <= 0 && !p.rasteira
    }
    if (JSON.stringify(novas) !== JSON.stringify(this.situacoes)) {
      this.situacoes = novas
      this.cb.aoSituacoes(novas)
    }
  }

  selecionar(id: string | null) {
    if (this.selecionado === id) return
    this.selecionado = id
    this.situacoes = {}
    this.atualizarSituacoes()
  }

  definirAreaUso(mostrar: boolean) {
    this.mostrarFolga = mostrar
    this.situacoes = {}
    this.atualizarSituacoes()
  }

  // --- Câmera ----------------------------------------------------------------

  definirModo(modo: Modo) {
    this.modo = modo
    this.controles3d.enabled = modo === '3d'
    this.controlesPlanta.enabled = modo === 'planta'
    this.controlesDentro.enabled = modo === 'dentro'
    this.interior.visible = modo === 'dentro'
    this.cena.background = modo === 'dentro' ? this.ceu : this.fundo
    this.caminhada = null
    this.marcar(true)
    this.centralizar()
  }

  get modoAtual() {
    return this.modo
  }

  private get camera() {
    return this.modo === '3d' ? this.camera3d : this.modo === 'dentro' ? this.cameraDentro : this.cameraPlanta
  }

  private get controles() {
    return this.modo === '3d' ? this.controles3d : this.modo === 'dentro' ? this.controlesDentro : this.controlesPlanta
  }

  /** Põe a câmera no ponto de vista do ambiente (ou num canto, olhando para o meio). */
  private entrar() {
    const { geo, planta } = this
    if (!geo || !planta) return
    const c = caixa(geo.contorno)
    const meio = { x: c.x + c.largura / 2, y: c.y + c.altura / 2 }
    let de = planta.vista?.de ?? { x: c.x + c.largura * 0.86, y: c.y + c.altura * 0.88 }
    if (!dentro(de, geo.contorno)) de = meio
    const para = planta.vista?.para ?? { ...meio, h: 110 }
    const olhos = Math.min(OLHOS, planta.peDireito - 30)
    this.cameraDentro.position.set(de.x * M, olhos * M, de.y * M)
    // O alvo fica a 1 cm, na direção do ponto de interesse: a câmera gira em volta de si mesma.
    const dir = new THREE.Vector3(para.x * M, ((para as { h?: number }).h ?? 110) * M, para.y * M).sub(this.cameraDentro.position).normalize()
    this.controlesDentro.target.copy(this.cameraDentro.position).addScaledVector(dir, 0.01)
    this.controlesDentro.update()
  }

  /** Anda na vista de dentro: `frente` e `lado` em metros, relativos para onde a câmera olha. */
  andar(frente: number, lado = 0) {
    if (this.modo !== 'dentro') return
    const olhar = new THREE.Vector3().subVectors(this.controlesDentro.target, this.cameraDentro.position).setY(0).normalize()
    const direita = new THREE.Vector3(-olhar.z, 0, olhar.x)
    const ate = (this.caminhada?.ate ?? this.cameraDentro.position).clone().addScaledVector(olhar, frente).addScaledVector(direita, lado)
    this.caminharAte(ate)
  }

  private caminharAte(ate: THREE.Vector3) {
    const geo = this.geo
    if (!geo) return
    const p = { x: ate.x / M, y: ate.z / M }
    // Não atravessa parede: o destino precisa estar dentro, longe das paredes.
    const longe = geo.paredes.every((w) => {
      const ab = sub(w.b, w.a)
      const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * ab.x + (p.y - w.a.y) * ab.y) / (w.comprimento ** 2 || 1)))
      return comprimento(sub(p, soma(w.a, escalar(ab, t)))) > FOLGA_ANDAR
    })
    if (!this.planta?.fachada && (!dentro(p, geo.contorno) || !longe)) return
    this.caminhada = { de: this.cameraDentro.position.clone(), ate: ate.setY(this.cameraDentro.position.y) }
  }

  private aoToqueDuplo = (e: MouseEvent) => {
    if (this.modo !== 'dentro') return
    const ponto = this.pontoNoChao(e as PointerEvent)
    if (!ponto) return
    // Para um pouco antes do ponto tocado, para não ficar em cima do que está lá.
    const cam = this.cameraDentro.position
    const dir = new THREE.Vector3(ponto.x - cam.x, 0, ponto.z - cam.z)
    const dist = Math.max(0, dir.length() - 0.5)
    this.caminharAte(cam.clone().addScaledVector(dir.normalize(), dist))
  }

  private aoRolar = (e: WheelEvent) => {
    if (this.modo !== 'dentro') return
    e.preventDefault()
    this.andar(-Math.sign(e.deltaY) * 0.35)
  }

  private aoTecla = (e: KeyboardEvent) => {
    const alvo = e.target as HTMLElement | null
    if (this.modo !== 'dentro' || alvo?.closest('input, textarea, select')) return
    const k = e.key.toLowerCase()
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return
    e.preventDefault()
    if (e.type === 'keydown') this.teclas.add(k)
    else this.teclas.delete(k)
  }

  /** A cada quadro: teclas pressionadas e a caminhada até o destino. */
  private moverDentro() {
    if (this.modo !== 'dentro') return
    const t = this.teclas
    const frente = (t.has('w') || t.has('arrowup') ? 1 : 0) - (t.has('s') || t.has('arrowdown') ? 1 : 0)
    const lado = (t.has('d') || t.has('arrowright') ? 1 : 0) - (t.has('a') || t.has('arrowleft') ? 1 : 0)
    if (frente || lado) this.andar(frente * 0.06, lado * 0.06)
    const c = this.caminhada
    if (!c) return
    const cam = this.cameraDentro.position
    const passo = new THREE.Vector3().subVectors(c.ate, cam).multiplyScalar(0.14)
    cam.add(passo)
    this.controlesDentro.target.add(passo)
    if (passo.lengthSq() < 1e-7) this.caminhada = null
  }

  centralizar() {
    this.marcar(true)
    if (!this.geo || !this.planta) return
    const c = caixa(this.geo.contorno)
    const alvo = new THREE.Vector3((c.x + c.largura / 2) * M, 0, (c.y + c.altura / 2) * M)
    const { width, height } = this.renderer.domElement
    const aspecto = width / Math.max(1, height)

    if (this.modo === 'dentro') return this.entrar()
    if (this.modo === '3d') {
      const fachada = !!this.planta.fachada
      // Esfera que envolve o cômodo inteiro, com as paredes do fundo de pé.
      const raio = Math.hypot(Math.hypot(c.largura, c.altura) / 2, this.planta.peDireito * 0.55) * M
      const fovV = THREE.MathUtils.degToRad(this.camera3d.fov) / 2
      const fov = Math.min(fovV, Math.atan(Math.tan(fovV) * aspecto))
      const dist = (raio / Math.sin(fov)) * (fachada ? 0.95 : 1.02)
      // A fachada é vista de frente e mais de baixo, como quem chega pela rua.
      const dir = (fachada ? new THREE.Vector3(0.45, 0.32, 1) : new THREE.Vector3(0.55, 0.85, 1)).normalize()
      this.camera3d.position.copy(alvo).addScaledVector(dir, dist)
      this.controles3d.target.copy(alvo).setY(this.planta.peDireito * M * (fachada ? 0.45 : 0.15))
      this.controles3d.update()
    } else {
      const meiaA = Math.max((c.altura / 2) * M, ((c.largura / 2) * M) / aspecto) * 1.18
      Object.assign(this.cameraPlanta, { left: -meiaA * aspecto, right: meiaA * aspecto, top: meiaA, bottom: -meiaA, zoom: 1 })
      this.cameraPlanta.position.copy(alvo).setY(30)
      this.controlesPlanta.target.copy(alvo)
      this.cameraPlanta.updateProjectionMatrix()
      this.controlesPlanta.update()
    }
  }

  private redimensionar() {
    const { clientWidth: l, clientHeight: a } = this.container
    if (!l || !a) return
    this.marcar()
    const primeira = this.renderer.domElement.width === 300 && this.renderer.domElement.height === 150
    this.renderer.setSize(l, a)
    const px = this.renderer.getPixelRatio()
    this.composer?.setPixelRatio(px)
    this.composer?.setSize(l, a)
    this.camera3d.aspect = l / a
    this.camera3d.updateProjectionMatrix()
    this.cameraDentro.aspect = l / a
    this.cameraDentro.updateProjectionMatrix()
    const meiaA = (this.cameraPlanta.top - this.cameraPlanta.bottom) / 2
    Object.assign(this.cameraPlanta, { left: (-meiaA * l) / a, right: (meiaA * l) / a })
    this.cameraPlanta.updateProjectionMatrix()
    if (primeira) this.centralizar()
  }

  // --- Ponteiro --------------------------------------------------------------

  private raioDe(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raio.setFromCamera(ndc, this.camera)
    return this.raio
  }

  private moveis(e: PointerEvent) {
    const alvos = [...this.objetos.values()].filter((o) => o.grupo.visible).flatMap((o) => [o.piso, ...(o.toque ? [o.toque] : [])])
    const acerto = this.raioDe(e).intersectObjects(alvos, false)[0]
    return (acerto?.object.userData.id as string | undefined) ?? null
  }

  private pontoNoChao(e: PointerEvent) {
    return this.raioDe(e).ray.intersectPlane(this.chao, new THREE.Vector3())
  }

  private aoPressionar = (e: PointerEvent) => {
    if (!e.isPrimary) return
    this.toque = { x: e.clientX, y: e.clientY }
    const id = this.moveis(e)
    if (!id) return
    const o = this.objetos.get(id)!
    const ponto = this.pontoNoChao(e)
    if (!ponto) return
    this.controles.enabled = false
    this.renderer.domElement.setPointerCapture(e.pointerId)
    // O que está apoiado em cima deste móvel vai junto.
    const minha = this.pegada(o)
    const carona = [...this.objetos.values()]
      .filter((c) => {
        const p = c !== o && minha && this.pegada(c)
        return !!p && !!minha && p.base > 0 && Math.abs(p.base - minha.topo) < 2 && dentroDaPegada(p, minha)
      })
      .map((c) => ({
        o: c,
        dx: c.grupo.position.x - o.grupo.position.x,
        dy: c.grupo.position.y - o.grupo.position.y,
        dz: c.grupo.position.z - o.grupo.position.z,
      }))
    this.arraste = { id, desvio: o.grupo.position.clone().sub(ponto), moveu: false, carona }
    this.selecionar(id)
    this.cb.aoSelecionar(id)
  }

  private aoMoverPonteiro = (e: PointerEvent) => {
    const a = this.arraste
    if (!a) {
      if (e.pointerType === 'mouse' && !e.buttons) this.renderer.domElement.style.cursor = this.moveis(e) ? 'grab' : ''
      return
    }
    if (!a.moveu && this.toque && Math.hypot(e.clientX - this.toque.x, e.clientY - this.toque.y) < 4) return
    a.moveu = true
    this.renderer.domElement.style.cursor = 'grabbing'
    const ponto = this.pontoNoChao(e)
    if (!ponto) return
    const o = this.objetos.get(a.id)!
    const destino = this.limitar(
      o,
      { x: o.grupo.position.x / M, y: o.grupo.position.z / M },
      { x: (ponto.x + a.desvio.x) / M, y: (ponto.z + a.desvio.z) / M },
    )
    const x = destino.x * M
    const z = destino.y * M
    const y = this.alturaDeApoio(o, destino.x, destino.y, a.carona.map((c) => c.o)) * M
    o.grupo.position.set(x, y, z)
    for (const c of a.carona) c.o.grupo.position.set(x + c.dx, y + c.dy, z + c.dz)
    this.atualizarSituacoes()
  }

  private aoSoltar = (e: PointerEvent) => {
    const a = this.arraste
    this.arraste = null
    this.controles.enabled = true
    if (a) {
      this.renderer.domElement.style.cursor = ''
      if (a.moveu) {
        const posicao = (m: Objeto) => ({
          x: Math.round(m.grupo.position.x / M),
          y: Math.round(m.grupo.position.z / M),
          elevacao: Math.round(m.grupo.position.y / M),
        })
        const o = this.objetos.get(a.id)!
        this.cb.aoMover(Object.fromEntries([o, ...a.carona.map((c) => c.o)].map((m) => [m.item.id, posicao(m)])))
      }
    } else if (this.toque && Math.hypot(e.clientX - this.toque.x, e.clientY - this.toque.y) < 4) {
      // Toque no fundo, sem girar: tira a seleção. Se foi numa parede, avisa (para pintar).
      this.selecionar(null)
      this.cb.aoSelecionar(null)
      const paredes = this.trechos.filter((t) => t.malha.visible).map((t) => t.malha)
      const acerto = this.raioDe(e).intersectObjects(paredes, false)[0]
      if (acerto) this.cb.aoTocarParede(acerto.object.userData.parede as number)
      else if (this.malhaPiso && this.raioDe(e).intersectObject(this.malhaPiso, false).length) this.cb.aoTocarPiso?.()
    }
    this.toque = null
  }

  // --- Quadro ----------------------------------------------------------------

  private sujo = true
  /** Último quadro desenhado sem oclusão de ambiente: falta o quadro "bonito" quando parar. */
  private faltaAO = false
  private ultimoMovimento = 0
  private chaveCasinha = ''

  /** Pede um novo quadro; `sombras`: algo mudou de lugar e o mapa de sombra precisa ser refeito. */
  private marcar(sombras = false) {
    this.sujo = true
    if (sombras) this.renderer.shadowMap.needsUpdate = true
  }

  /**
   * Só desenha quando algo muda. Em movimento (girar, andar, arrastar), desenha sem a oclusão de
   * ambiente, que é a parte cara; quando a câmera para, um quadro com ela.
   */
  private quadro = () => {
    this.moverDentro()
    const agora = performance.now()
    if (this.controles.update() || this.caminhada || this.arraste?.moveu) {
      this.sujo = true
      this.ultimoMovimento = agora
    }
    const parado = agora - this.ultimoMovimento > 200
    if (parado && this.faltaAO) this.sujo = true
    if (!this.sujo) return
    this.sujo = false
    this.paredesDeCasinha()
    this.posicionarRotulo()
    this.desenhar(parado)
  }

  /** Com oclusão de ambiente nas vistas em perspectiva; a planta (ortográfica) vai direto. */
  private desenhar(comAO = true) {
    const camera = this.camera
    const ao = this.composer && this.passeRender && this.passeAO && camera !== this.cameraPlanta
    if (ao && comAO) {
      this.passeRender!.camera = camera
      this.passeAO!.camera = camera
      this.composer!.render()
    } else this.renderer.render(this.cena, camera)
    this.faltaAO = !!ao && !comAO
  }

  /** Abaixa as paredes viradas para a câmera, como numa casinha de bonecas, para ver o cômodo por dentro. */
  private paredesDeCasinha() {
    const cam = new THREE.Vector2(this.camera3d.position.x, this.camera3d.position.z)
    const casinha = this.modo === '3d' && !this.planta?.fachada
    const baixas = new Set<number>()
    for (const d of this.detalhes) d.obj.visible = !(casinha && d.normal.dot(cam.clone().sub(d.centro)) > 0)
    for (const t of this.trechos) {
      const baixa = casinha && t.normal.dot(cam.clone().sub(t.centro)) > 0
      if (baixa) baixas.add(t.parede)
      if (t.verga) {
        t.malha.visible = !baixa
        continue
      }
      const altura = baixa ? Math.min(RODAPE, t.altura) : t.altura
      t.malha.scale.y = altura / t.altura
      t.malha.position.y = (altura / 2) * M
    }
    this.pecasDeParede(baixas)
    const chave = [...baixas].sort().join(',') + this.modo
    if (chave !== this.chaveCasinha) {
      this.chaveCasinha = chave
      this.renderer.shadowMap.needsUpdate = true
    }
  }

  /** Quadros, TVs e cortinas vão junto com a parede em que estão encostados. */
  private pecasDeParede(baixas: Set<number>) {
    if (!this.geo) return
    for (const o of this.objetos.values()) {
      if (!o.peca?.naParede || !o.modelo) continue
      const p = { x: o.grupo.position.x / M, y: o.grupo.position.z / M }
      let perto = -1
      let menor = Infinity
      this.geo.paredes.forEach((w, i) => {
        const ab = sub(w.b, w.a)
        const t = Math.max(0, Math.min(1, ((p.x - w.a.x) * ab.x + (p.y - w.a.y) * ab.y) / (w.comprimento ** 2 || 1)))
        const d = comprimento(sub(p, soma(w.a, escalar(ab, t))))
        if (d < menor) [menor, perto] = [d, i]
      })
      o.modelo.visible = !(baixas.has(perto) && menor < 40)
    }
  }

  private posicionarRotulo() {
    if (!this.rotulo) return
    const o = this.selecionado ? this.objetos.get(this.selecionado) : null
    if (!o?.modelo || !o.grupo.visible) {
      this.rotulo.style.visibility = 'hidden'
      return
    }
    const p = o.grupo.position.clone().setY(o.grupo.position.y + o.altura + 0.12).project(this.camera)
    const { clientWidth: l, clientHeight: a } = this.container
    this.rotulo.style.visibility = p.z < 1 ? 'visible' : 'hidden'
    this.rotulo.style.transform = `translate(${((p.x + 1) / 2) * l}px, ${((1 - p.y) / 2) * a}px) translate(-50%, -100%)`
  }

  /** Espera todos os modelos entrarem na cena. */
  async pronto() {
    await Promise.all([...this.objetos.values()].map((o) => o.carga))
  }

  /** Foto da vista atual (JPEG), sem a seleção. */
  capturar(qualidade = 0.9) {
    const antes = this.selecionado
    this.selecionar(null)
    if (this.rotulo) this.rotulo.style.visibility = 'hidden'
    this.paredesDeCasinha()
    this.desenhar()
    const url = this.renderer.domElement.toDataURL('image/jpeg', qualidade)
    this.selecionar(antes)
    return url
  }

  destruir() {
    this.vivo = false
    this.renderer.setAnimationLoop(null)
    this.observador.disconnect()
    this.controles3d.dispose()
    this.controlesPlanta.dispose()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.aoPressionar)
    el.removeEventListener('pointermove', this.aoMoverPonteiro)
    el.removeEventListener('pointerup', this.aoSoltar)
    el.removeEventListener('pointercancel', this.aoSoltar)
    el.removeEventListener('dblclick', this.aoToqueDuplo)
    el.removeEventListener('wheel', this.aoRolar)
    window.removeEventListener('keydown', this.aoTecla)
    window.removeEventListener('keyup', this.aoTecla)
    this.controlesDentro.dispose()
    this.composer?.dispose()
    this.passeAO?.dispose()
    this.texturasPapel.forEach((t) => t.dispose())
    for (const o of this.objetos.values()) if (o.peca && o.modelo) descartarPeca(o.modelo)
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    el.remove()
  }
}

const assinaturaPeca = (i: Item) => JSON.stringify([i.medidas, i.cores])
