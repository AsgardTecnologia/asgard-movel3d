import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buscarMovel, type Movel } from '../data/moveis'
import { asperezaPiso, desenharPiso, tamanhoPiso } from './texturasPiso'
import {
  AREA_USO,
  areasPortas,
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
const ALTURA_PORTA = 210

export type Modo = '3d' | 'planta'

type Callbacks = {
  aoSelecionar: (id: string | null) => void
  /** Fim de um arraste: grava as novas posições (com desfazer), inclusive do que estava em cima do móvel. */
  aoMover: (mudancas: Record<string, { x: number; y: number; elevacao: number }>) => void
  /** Lugar livre encontrado para um móvel recém-adicionado (sem desfazer). */
  aoPosicionar: (id: string, x: number, y: number) => void
  aoSituacoes: (s: Record<string, Situacao>) => void
  /** Toque (sem arrastar) numa parede. */
  aoTocarParede: (parede: number) => void
}

type Objeto = {
  item: Item
  movel: Movel
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
  private modo: Modo = '3d'
  private comodo = new THREE.Group()
  private trechos: TrechoParede[] = []
  private sol: THREE.DirectionalLight
  private objetos = new Map<string, Objeto>()
  private geo: Geometria | null = null
  private planta: Planta | null = null
  private portas: Ponto[][] = []
  private selecionado: string | null = null
  private mostrarFolga = true
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    this.cena.background = new THREE.Color('#e4ddd2')
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.cena.environmentIntensity = 0.35
    pmrem.dispose()

    this.cena.add(new THREE.HemisphereLight('#ffffff', '#cfc5b6', 0.75))
    this.sol = new THREE.DirectionalLight('#fff6ea', 1.5)
    this.sol.castShadow = true
    this.sol.shadow.mapSize.set(2048, 2048)
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

    const forma = new THREE.Shape(geo.contorno.map((p) => new THREE.Vector2(p.x * M, -p.y * M)))
    const piso = new THREE.Mesh(new THREE.ShapeGeometry(forma), this.materialPiso)
    piso.rotation.x = -Math.PI / 2
    piso.receiveShadow = true
    this.comodo.add(piso)

    const h = planta.peDireito

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
      const malha = new THREE.Mesh(new THREE.BoxGeometry((l + ESPESSURA) * M, altura * M, ESPESSURA * M), materiais)
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
      const dir = escalar(sub(p.b, p.a), 1 / (p.comprimento || 1))
      const centro = escalar(soma(p.inicio, p.fim), 0.5)
      // Vãos das portas desta parede, em cm a partir de `a`.
      const vaos = planta.portas
        .filter((pt) => pt.parede === i)
        .map((pt) => {
          const c = comprimento(sub(pontoNaParede(p, pt.t), p.a))
          return [c - pt.largura / 2, c + pt.largura / 2]
        })
        .sort((x, y) => x[0] - y[0])

      let cursor = comprimento(sub(p.inicio, p.a))
      const fim = comprimento(sub(p.fim, p.a))
      const ponto = (d: number) => soma(p.a, escalar(dir, d))
      for (const [ini, fimVao] of vaos) {
        trecho(i, ponto(cursor), ponto(ini), p.normal, 0, h, centro)
        trecho(i, ponto(ini), ponto(fimVao), p.normal, ALTURA_PORTA, h - ALTURA_PORTA, centro, true)
        cursor = fimVao
      }
      trecho(i, ponto(cursor), ponto(fim), p.normal, 0, h, centro)
    })

    geo.arcos.forEach((arco, j) => {
      for (let k = 0; k < arco.length - 1; k++) {
        const n = normalExterna(arco[k], arco[k + 1], geo.sentido)
        trecho(geo.cantosArco[j], arco[k], arco[k + 1], n, 0, h, escalar(soma(arco[k], arco[k + 1]), 0.5))
      }
    })

    // Sombra do sol cobrindo o cômodo inteiro.
    const c = caixa(geo.contorno)
    const centro = new THREE.Vector3((c.x + c.largura / 2) * M, 0, (c.y + c.altura / 2) * M)
    const raio = (Math.hypot(c.largura, c.altura) / 2) * M + 1
    this.sol.position.copy(centro).add(new THREE.Vector3(raio * 0.6, raio * 1.6, raio * 0.9))
    this.sol.target.position.copy(centro)
    Object.assign(this.sol.shadow.camera, { left: -raio, right: raio, top: raio, bottom: -raio, far: raio * 5 })
    this.sol.shadow.camera.updateProjectionMatrix()
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
    m.color.set(this.acabamento ? corDaParede(this.acabamento, parede) : '#f3eee6')
    m.emissiveIntensity = parede === this.paredeDestacada ? 0.28 : 0
  }

  definirAcabamento(a: Acabamento) {
    this.acabamento = a
    for (const parede of this.materiaisParede.keys()) this.pintarParede(parede)

    const piso = `${a.piso}${a.corPiso}`
    if (piso === this.pisoAtual) return
    this.pisoAtual = piso
    const textura = new THREE.CanvasTexture(desenharPiso(a.piso, a.corPiso))
    textura.colorSpace = THREE.SRGBColorSpace
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping
    textura.repeat.setScalar(1 / tamanhoPiso[a.piso])
    textura.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.materialPiso.map?.dispose()
    this.materialPiso.map = textura
    this.materialPiso.roughness = asperezaPiso[a.piso]
    this.materialPiso.needsUpdate = true
  }

  /** Realça a parede que está sendo pintada. */
  destacarParede(parede: number | null) {
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
      const movel = buscarMovel(item.slug)
      if (!movel?.modelo) continue
      let o = this.objetos.get(item.id)
      if (!o) {
        o = this.criarObjeto(item, movel)
        this.objetos.set(item.id, o)
      }
      const corMudou = o.item.cor !== item.cor
      o.item = item
      if (corMudou && o.modelo) aplicarCor(o.modelo, movel, item.cor)
      const arrastado = this.arraste && (this.arraste.id === item.id || this.arraste.carona.some((c) => c.o === o))
      if (!arrastado && item.x != null && item.y != null) o.grupo.position.set(item.x * M, (item.elevacao ?? 0) * M, item.y * M)
      o.grupo.rotation.y = (-item.giro * Math.PI) / 180
      o.grupo.visible = item.x != null
    }
    this.atualizarSituacoes()
  }

  private criarObjeto(item: Item, movel: Movel): Objeto {
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

    const o: Objeto = { item, movel, grupo, modelo: null, toque: null, meia: null, altura: 0, piso, borda, folga }

    carregar(movel.modelo!.src).then((gltf) => {
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
      const toque = new THREE.Mesh(new THREE.BoxGeometry(tam.x, tam.y, tam.z), new THREE.MeshBasicMaterial({ visible: false }))
      toque.position.y = tam.y / 2
      toque.userData.id = item.id
      grupo.add(modelo, toque)
      o.modelo = modelo
      o.toque = toque
      o.meia = { l: (tam.x / M) / 2, p: (tam.z / M) / 2 }
      o.altura = tam.y
      aplicarCor(modelo, movel, o.item.cor)

      piso.scale.set(tam.x, 1, tam.z)
      borda.geometry.dispose()
      borda.geometry = retangulo(tam.x / 2, tam.z / 2)
      folga.geometry.dispose()
      folga.geometry = retangulo(tam.x / 2 + AREA_USO * M, tam.z / 2 + AREA_USO * M)
      folga.computeLineDistances()

      if (o.item.x == null || o.item.y == null) {
        const lugar = this.acharLugar(o)
        o.grupo.position.set(lugar.x * M, (o.item.elevacao ?? 0) * M, lugar.y * M)
        this.cb.aoPosicionar(item.id, lugar.x, lugar.y)
      }
      grupo.visible = true
      this.atualizarSituacoes()
    })
    return o
  }

  private pegada(o: Objeto, x = o.grupo.position.x / M, y = o.grupo.position.z / M): Pegada | null {
    if (!o.meia) return null
    const base = o.grupo.position.y / M
    return { x, y, meiaL: o.meia.l, meiaP: o.meia.p, giro: o.item.giro, base, topo: base + o.altura / M }
  }

  /** Altura (cm) onde o móvel fica se for solto em (x, y): no tampo do apoio mais alto embaixo dele, ou no chão. */
  private alturaDeApoio(o: Objeto, x: number, y: number, ignorar: Objeto[]) {
    const minha = o.meia ? o.meia.l * o.meia.p : 0
    let altura = 0
    for (const apoio of this.objetos.values()) {
      if (apoio === o || ignorar.includes(apoio) || !apoio.movel.modelo?.apoio || !apoio.grupo.visible) continue
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
    for (let x = c.x; x <= c.x + c.largura; x += 15)
      for (let y = c.y; y <= c.y + c.altura; y += 15) if (dentro({ x, y }, geo.contorno)) candidatos.push({ x, y })
    candidatos.sort((a, b) => comprimento(sub(a, centro)) - comprimento(sub(b, centro)))
    let apertado: Ponto | null = null
    for (const p of candidatos) {
      const s = situacao(this.pegada(o, p.x, p.y)!, outras, geo, this.portas)
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
    if (!this.geo) return
    const novas: Record<string, Situacao> = {}
    for (const o of this.objetos.values()) {
      const p = this.pegada(o)
      if (!p || !o.grupo.visible) continue
      const s = situacao(p, this.pegadasExceto(o.item.id), this.geo, this.portas)
      novas[o.item.id] = s
      const cor = new THREE.Color(coresSituacao[s])
      const ativo = o.item.id === this.selecionado
      o.piso.material.color.copy(cor)
      o.piso.material.opacity = ativo ? 0.38 : 0.2
      o.borda.material.color.copy(cor)
      o.folga.material.color.copy(cor)
      o.folga.visible = (this.mostrarFolga || ativo) && p.base <= 0
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
    this.centralizar()
  }

  private get camera() {
    return this.modo === '3d' ? this.camera3d : this.cameraPlanta
  }

  private get controles() {
    return this.modo === '3d' ? this.controles3d : this.controlesPlanta
  }

  centralizar() {
    if (!this.geo || !this.planta) return
    const c = caixa(this.geo.contorno)
    const alvo = new THREE.Vector3((c.x + c.largura / 2) * M, 0, (c.y + c.altura / 2) * M)
    const { width, height } = this.renderer.domElement
    const aspecto = width / Math.max(1, height)

    if (this.modo === '3d') {
      const raio = Math.max((Math.hypot(c.largura, c.altura) / 2) * M, (this.planta.peDireito * M) / 1.5)
      const fovV = THREE.MathUtils.degToRad(this.camera3d.fov) / 2
      const fov = Math.min(fovV, Math.atan(Math.tan(fovV) * aspecto))
      const dist = (raio / Math.sin(fov)) * 1.02
      const dir = new THREE.Vector3(0.55, 0.85, 1).normalize()
      this.camera3d.position.copy(alvo).addScaledVector(dir, dist)
      this.controles3d.target.copy(alvo).setY(this.planta.peDireito * M * 0.15)
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
    const primeira = this.renderer.domElement.width === 300 && this.renderer.domElement.height === 150
    this.renderer.setSize(l, a)
    this.camera3d.aspect = l / a
    this.camera3d.updateProjectionMatrix()
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
    const x = ponto.x + a.desvio.x
    const z = ponto.z + a.desvio.z
    const y = this.alturaDeApoio(o, x / M, z / M, a.carona.map((c) => c.o)) * M
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
    }
    this.toque = null
  }

  // --- Quadro ----------------------------------------------------------------

  private quadro = () => {
    this.controles.update()
    this.paredesDeCasinha()
    this.posicionarRotulo()
    this.renderer.render(this.cena, this.camera)
  }

  /** Abaixa as paredes viradas para a câmera, como numa casinha de bonecas, para ver o cômodo por dentro. */
  private paredesDeCasinha() {
    const cam = new THREE.Vector2(this.camera3d.position.x, this.camera3d.position.z)
    for (const t of this.trechos) {
      const baixa = this.modo === '3d' && t.normal.dot(cam.clone().sub(t.centro)) > 0
      if (t.verga) {
        t.malha.visible = !baixa
        continue
      }
      const altura = baixa ? Math.min(RODAPE, t.altura) : t.altura
      t.malha.scale.y = altura / t.altura
      t.malha.position.y = (altura / 2) * M
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
    this.renderer.dispose()
    el.remove()
  }
}
