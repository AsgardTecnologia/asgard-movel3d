import * as THREE from 'three'
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js'
import { XREstimatedLight } from 'three/examples/jsm/webxr/XREstimatedLight.js'
import type { Acabamento } from './ambiente'
import { asperezaPiso, desenharPiso, tamanhoPiso } from './texturasPiso'
import { desenharPapel, tamanhoPapel } from './texturasParede'

/*
 * Provador de piso e parede em realidade aumentada.
 * Android (WebXR): no piso, um toque põe um piso quadrado no chão; a pinça (ou os botões) aumenta e
 * diminui, e outro toque muda de lugar. Na parede, a pessoa marca os cantos no pé dela: entre dois
 * cantos sobe uma parede do chão até o pé-direito (funciona mesmo com parede branca lisa, que o ARCore
 * quase nunca detecta), e as paredes cortam o piso onde ele passaria delas.
 * Com o sensor de profundidade do aparelho, o que está na frente (sofá, mesa, pessoas) esconde o piso e
 * a parede: o piso passa "por baixo" dos móveis. Tudo fica preso a uma âncora no primeiro toque, para
 * não flutuar quando o rastreamento se corrige, e o chão tem uma altura só (a do primeiro toque).
 * iPhone (sem WebXR): uma amostra em tamanho real aberta no Quick Look.
 */

export type Superficie = 'piso' | 'parede'
/**
 * O que a mira está vendo. 'pronto': um ponto no chão onde dá para marcar um canto. 'fechar': o primeiro
 * canto (tocar fecha o piso). 'movel': uma superfície alta demais para ser o chão.
 */
export type Alvo = 'procurando' | 'pronto' | 'fechar' | 'movel'
/** `piso`: já tem piso no chão; `lado`: o lado dele, em metros; `oclusao`: os móveis escondem o piso. */
export type EstadoRA = { alvo: Alvo; cantos: number; fechado: boolean; piso: boolean; lado: number; oclusao: boolean }
export type SuporteRA = 'webxr' | 'quicklook' | null

const LARGURA_PAREDE = 3
/** Altura do celular na mão, para achar o chão quando ainda não se viu nenhum. */
const ALTURA_OLHO = 1.4
/** Superfície horizontal mais alta que isso acima do chão é um móvel (mesa, cama). */
const ALTURA_MOVEL = 0.25
/** Perto assim do primeiro canto, o toque fecha o piso. */
const IMA_FECHAR = 0.3
/** Até este desvio do ângulo reto, o canto segue o esquadro. */
const ESQUADRO = THREE.MathUtils.degToRad(9)
/** Lado do piso ao ser colocado, e os limites da pinça, em metros. */
const LADO_INICIAL = 2.5
const LADO_MIN = 0.6
const LADO_MAX = 12

const CIMA = new THREE.Vector3(0, 1, 0)

export async function suporteRA(): Promise<SuporteRA> {
  if (document.createElement('a').relList.supports('ar')) return 'quicklook'
  const ok = await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false)
  return ok ? 'webxr' : null
}

// --- Texturas e máscaras ---------------------------------------------------------

function texturaRepetida(canvas: HTMLCanvasElement, metros: number) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.setScalar(1 / metros)
  t.anisotropy = 8
  return t
}

const texturaPiso = (a: Acabamento) => texturaRepetida(desenharPiso(a.piso, a.corPiso), tamanhoPiso[a.piso])
const texturaParede = (a: Acabamento) => texturaRepetida(desenharPapel(a.papel, a.paredes), tamanhoPapel[a.papel])

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Máscara de transparência (branco = opaco), lida pelo segundo UV (`uv1`), de 0 a 1 em cada trecho. */
function mascara(opacidade: (u: number, v: number) => number) {
  const lado = 128
  const c = document.createElement('canvas')
  c.width = c.height = lado
  const g = c.getContext('2d')!
  const img = g.createImageData(lado, lado)
  for (let j = 0; j < lado; j++)
    for (let i = 0; i < lado; i++) {
      const k = (j * lado + i) * 4
      img.data[k] =
        img.data[k + 1] =
        img.data[k + 2] =
          Math.round(255 * opacidade((i + 0.5) / lado, 1 - (j + 0.5) / lado))
      img.data[k + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.channel = 1
  return t
}

// --- Geometria ----------------------------------------------------------------------

/** Piso: o polígono dos cantos, um pouco acima do chão. O desenho segue `eixo` (a primeira parede). */
function geometriaPiso(cantos: THREE.Vector3[], eixo: THREE.Vector2) {
  const g = new THREE.BufferGeometry()
  if (cantos.length < 3) return g
  const contorno = cantos.map((p) => new THREE.Vector2(p.x, p.z))
  // A ordem dos triângulos segue o sentido em que os cantos foram marcados. Virados para baixo, o
  // DoubleSide inverte a normal e o piso fica escuro: todos vão para cima.
  const tris = THREE.ShapeUtils.triangulateShape(contorno, []).map(([a, b, c]) => {
    const [pa, pb, pc] = [contorno[a], contorno[b], contorno[c]]
    const y = (pb.y - pa.y) * (pc.x - pa.x) - (pb.x - pa.x) * (pc.y - pa.y)
    return y < 0 ? [a, c, b] : [a, b, c]
  })
  const pos: number[] = []
  const uv: number[] = []
  for (const p of cantos) {
    pos.push(p.x, p.y + 0.004, p.z)
    uv.push(p.x * eixo.x + p.z * eixo.y, -p.x * eixo.y + p.z * eixo.x)
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(cantos.flatMap(() => [0, 1, 0]), 3))
  g.setIndex(tris.flat())
  return g
}

/** Piso quadrado de `lado` metros centrado em `c`, alinhado com `eixo`. */
function cantosDoQuadrado(c: THREE.Vector3, lado: number, eixo: THREE.Vector2) {
  const m = lado / 2
  const ex = new THREE.Vector3(eixo.x, 0, eixo.y).multiplyScalar(m)
  const ez = new THREE.Vector3(-eixo.y, 0, eixo.x).multiplyScalar(m)
  return [
    c.clone().sub(ex).sub(ez),
    c.clone().add(ex).sub(ez),
    c.clone().add(ex).add(ez),
    c.clone().sub(ex).add(ez),
  ]
}

/**
 * Oclusão pelo sensor de profundidade: onde algo real está mais perto da câmera que a superfície
 * (com folga, porque a profundidade medida treme alguns centímetros), a superfície some.
 */
type Oclusao = {
  uProf: { value: THREE.DataTexture | null }
  uProfMat: { value: THREE.Matrix4 }
  uTela: { value: THREE.Vector2 }
  uOcluir: { value: number }
}

function ocluir(material: THREE.MeshStandardMaterial, o: Oclusao) {
  material.transparent = true
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, o)
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uProf;
uniform mat4 uProfMat;
uniform vec2 uTela;
uniform float uOcluir;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
if (uOcluir > 0.5) {
  // Coordenadas da vista começam no canto de cima; as do WebGL, no de baixo.
  vec2 vista = vec2(gl_FragCoord.x / uTela.x, 1.0 - gl_FragCoord.y / uTela.y);
  vec2 d = (uProfMat * vec4(vista, 0.0, 1.0)).xy;
  float real = texture2D(uProf, d).r;
  float minha = vViewPosition.z;
  float folga = 0.06 + 0.03 * minha;
  if (real > 0.05) gl_FragColor.a *= 1.0 - smoothstep(folga, folga + 0.15, minha - real);
  if (gl_FragColor.a < 0.01) discard;
}`,
      )
  }
  material.customProgramCacheKey = () => 'ocluir'
}

/**
 * Paredes em pé entre cantos seguidos, do chão até `altura`. O desenho corre pelo contorno, então o
 * papel continua de uma parede para a outra; `inicio` é onde ele começa (em metros de contorno).
 */
function geometriaParedes(segmentos: [THREE.Vector3, THREE.Vector3][], altura: number, inicio = 0) {
  const pos: number[] = []
  const uv: number[] = []
  const nor: number[] = []
  let u = inicio
  for (const [a, b] of segmentos) {
    const l = a.distanceTo(b)
    if (l < 0.01) continue
    const nx = -(b.z - a.z) / l
    const nz = (b.x - a.x) / l
    const y0 = a.y
    const y1 = a.y + altura
    const v = [
      [a.x, y0, a.z, u, 0],
      [b.x, y0, b.z, u + l, 0],
      [b.x, y1, b.z, u + l, altura],
      [a.x, y0, a.z, u, 0],
      [b.x, y1, b.z, u + l, altura],
      [a.x, y1, a.z, u, altura],
    ]
    for (const [x, y, z, s, t] of v) {
      pos.push(x, y, z)
      uv.push(s, t)
      nor.push(nx, 0, nz)
    }
    u += l
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}

type Mira = { ponto: THREE.Vector3; tipo: 'chao' | 'parede'; valida: boolean }

type Callbacks = {
  aoEstado: (e: EstadoRA) => void
  aoEncerrar: () => void
}

export class ProvadorXR {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  private cena = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera()
  /** O que fica preso ao cômodo: segue a âncora. Os pontos guardados estão nas coordenadas dele. */
  private preso = new THREE.Group()
  private luzPadrao = new THREE.Group()
  private luzEstimada: XREstimatedLight
  private sessao: XRSession | null = null
  private fonte: XRHitTestSource | null = null
  private ancora: XRAnchor | null = null
  /** Pose da âncora quando nasceu; a diferença para a pose atual é a correção do rastreamento. */
  private poseInicial: THREE.Matrix4 | null = null
  private paraPreso = new THREE.Matrix4()
  private modo: Superficie = 'piso'
  private mapas: Record<Superficie, THREE.CanvasTexture>
  private acabamento: Acabamento
  private altura: number
  private olho = new THREE.Vector3()
  private frente = new THREE.Vector3(0, 0, -1)

  private cantos: THREE.Vector3[] = []
  private fechado = false
  /** Centro e lado do piso (nas coordenadas presas); o piso segue o eixo da primeira parede ou do olhar. */
  private centroPiso: THREE.Vector3 | null = null
  private lado = LADO_INICIAL
  private eixoPiso = new THREE.Vector2(1, 0)
  private historico: (
    | { tipo: 'piso'; antes: { centro: THREE.Vector3 | null; lado: number } }
    | { tipo: 'canto' | 'fechar' }
  )[] = []
  /** Paredes como planos de corte do piso, nas coordenadas presas (normal para dentro do cômodo). */
  private cortesPresos: THREE.Plane[] = []
  private cortes: THREE.Plane[] = []
  private pinca: { distancia: number; lado: number } | null = null
  private ultimaPinca = 0
  private oclusao: Oclusao = {
    uProf: { value: null },
    uProfMat: { value: new THREE.Matrix4() },
    uTela: { value: new THREE.Vector2(1, 1) },
    uOcluir: { value: 0 },
  }
  private dadosProf: Float32Array | null = null
  /** Altura do chão (nas coordenadas presas): a do primeiro canto ou, antes dele, a mais baixa já vista. */
  private chaoFixo: number | null = null
  private chaoVisto: number | null = null
  private mira: Mira = { ponto: new THREE.Vector3(), tipo: 'chao', valida: false }
  /** Onde o próximo canto cai (já no chão, com ímã e esquadro), nas coordenadas presas. */
  private cursor = new THREE.Vector3()
  private alvo: Alvo = 'procurando'

  private piso: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private paredes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private paredeNova: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private amostra: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>
  private contorno: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private marcas = new THREE.Group()
  private poste: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>
  private anel: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private branco = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true })
  private geoMarca = new THREE.CircleGeometry(0.035, 24)
  private chaveDesenho = ''
  /** Já marcou parede (no modo parede): as paredes seguem à vista também no modo piso. */
  private comParedes = false
  private overlay: HTMLElement
  private cb: Callbacks
  private emitido = ''

  /** `altura`: pé-direito, em metros. */
  constructor(overlay: HTMLElement, acabamento: Acabamento, altura: number, cb: Callbacks) {
    this.overlay = overlay
    this.acabamento = acabamento
    this.altura = altura
    this.cb = cb

    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.xr.enabled = true
    this.renderer.localClippingEnabled = true

    const hemisferio = new THREE.HemisphereLight('#ffffff', '#9c958b', 1.6)
    const sol = new THREE.DirectionalLight('#fff6ea', 0.5)
    sol.position.set(0.4, 1, 0.3)
    this.luzPadrao.add(hemisferio, sol)
    this.preso.matrixAutoUpdate = false
    this.cena.add(this.luzPadrao, this.preso)

    // A luz do cômodo (quando o aparelho estima) deixa o piso e a parede com o brilho do ambiente real.
    this.luzEstimada = new XREstimatedLight(this.renderer)
    this.luzEstimada.addEventListener('estimationstart', () => {
      this.cena.remove(this.luzPadrao)
      this.cena.add(this.luzEstimada)
      if (this.luzEstimada.environment) this.cena.environment = this.luzEstimada.environment
    })
    this.luzEstimada.addEventListener('estimationend', () => {
      this.cena.remove(this.luzEstimada)
      this.cena.add(this.luzPadrao)
      this.cena.environment = null
    })

    this.mapas = { piso: texturaPiso(acabamento), parede: texturaParede(acabamento) }
    const material = (s: Superficie, opacidade = 1) =>
      new THREE.MeshStandardMaterial({
        map: this.mapas[s],
        roughness: s === 'piso' ? asperezaPiso[acabamento.piso] : 0.9,
        side: THREE.DoubleSide,
        transparent: opacidade < 1,
        opacity: opacidade,
        depthWrite: opacidade === 1,
      })
    const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.MeshStandardMaterial, ordem: number) => {
      const x = new THREE.Mesh(g, m)
      // A geometria muda a cada quadro e já vem nas coordenadas presas.
      x.frustumCulled = false
      x.renderOrder = ordem
      return x
    }
    this.piso = malha(new THREE.BufferGeometry(), material('piso'), 1)
    this.paredes = malha(new THREE.BufferGeometry(), material('parede'), 2)
    this.paredeNova = malha(new THREE.BufferGeometry(), material('parede', 0.6), 3)

    // Antes do primeiro canto: um círculo do piso escolhido na mira, para já ver o material no chão.
    const circulo = new THREE.CircleGeometry(0.7, 48)
    circulo.rotateX(-Math.PI / 2)
    circulo.setAttribute('uv1', circulo.getAttribute('uv').clone())
    const uvCirculo = circulo.getAttribute('uv')
    for (let i = 0; i < uvCirculo.count; i++) uvCirculo.setXY(i, uvCirculo.getX(i) * 1.4, uvCirculo.getY(i) * 1.4)
    const matAmostra = material('piso', 0.999)
    matAmostra.alphaMap = mascara((u, v) => 1 - suave(0.55, 1, Math.hypot(u - 0.5, v - 0.5) * 2))
    this.amostra = malha(circulo, matAmostra, 3)
    for (const m of [this.piso, this.paredes, this.paredeNova, this.amostra]) ocluir(m.material, this.oclusao)
    this.piso.material.clippingPlanes = this.cortes

    this.contorno = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.9 }),
    )
    this.contorno.frustumCulled = false
    this.contorno.renderOrder = 4
    this.marcas.renderOrder = 4

    // Mira no modo parede: um poste mostra a altura que a parede vai ter.
    this.poste = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 1, 8).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthTest: false }),
    )
    this.poste.renderOrder = 4

    this.anel = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.1, 40).rotateX(-Math.PI / 2), this.branco)
    const ponto = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20).rotateX(-Math.PI / 2), this.branco)
    this.anel.renderOrder = ponto.renderOrder = 5
    this.anel.add(ponto)

    this.preso.add(this.piso, this.paredes, this.paredeNova, this.amostra, this.contorno, this.marcas, this.poste, this.anel)
  }

  async iniciar() {
    // Pedido antes de qualquer await: o navegador só abre a câmera dentro do toque do usuário.
    const sessao = await navigator.xr!.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'light-estimation', 'anchors', 'depth-sensing'],
      domOverlay: { root: this.overlay },
      // Na CPU: funciona igual em todo Android com ARCore (a versão na placa de vídeo varia por aparelho).
      depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] },
    })
    this.sessao = sessao
    sessao.addEventListener('end', this.aoEncerrar)
    sessao.addEventListener('select', this.aoTocar)
    this.renderer.xr.setReferenceSpaceType('local')
    await this.renderer.xr.setSession(sessao)
    const viewer = await sessao.requestReferenceSpace('viewer')
    this.fonte = (await sessao.requestHitTestSource?.({ space: viewer })) ?? null
    this.renderer.setAnimationLoop(this.quadro)
    this.overlay.addEventListener('touchstart', this.aoPincar, { passive: true })
    this.overlay.addEventListener('touchmove', this.aoPincar, { passive: true })
    this.overlay.addEventListener('touchend', this.aoSoltar)
    this.overlay.addEventListener('touchcancel', this.aoSoltar)
    this.emitir()
  }

  encerrar() {
    if (this.sessao) this.sessao.end().catch(() => {})
    else this.descartar()
  }

  definirModo(modo: Superficie) {
    this.modo = modo
    this.chaveDesenho = ''
  }

  definirAcabamento(a: Acabamento) {
    const antes = this.acabamento
    this.acabamento = a
    if (a.piso !== antes.piso || a.corPiso !== antes.corPiso) {
      this.trocarMapa('piso', texturaPiso(a))
      for (const m of [this.piso, this.amostra]) m.material.roughness = asperezaPiso[a.piso]
    }
    if (a.papel !== antes.papel || a.paredes !== antes.paredes) this.trocarMapa('parede', texturaParede(a))
  }

  /** Segurar "comparar" esconde tudo o que foi aplicado (e as prévias) para ver o original. */
  mostrar(visivel: boolean) {
    this.preso.visible = visivel
  }

  /** Fecha as paredes no primeiro canto (o mesmo que tocar nele). */
  fechar() {
    if (this.cantos.length < 3 || this.fechado) return
    this.fechado = true
    this.historico.push({ tipo: 'fechar' })
    this.mudou()
  }

  /** Aumenta (fator > 1) ou diminui o piso. */
  redimensionar(fator: number) {
    if (!this.centroPiso) return
    this.historico.push({ tipo: 'piso', antes: { centro: this.centroPiso, lado: this.lado } })
    this.lado = THREE.MathUtils.clamp(this.lado * fator, LADO_MIN, LADO_MAX)
    this.mudou()
  }

  desfazer() {
    const ultimo = this.historico.pop()
    if (!ultimo) return
    if (ultimo.tipo === 'piso') {
      this.centroPiso = ultimo.antes.centro
      this.lado = ultimo.antes.lado
    } else if (ultimo.tipo === 'fechar') this.fechado = false
    else this.cantos.pop()
    if (!this.cantos.length && !this.centroPiso) this.chaoFixo = null
    this.mudou()
  }

  limpar() {
    this.cantos = []
    this.fechado = false
    this.comParedes = false
    this.centroPiso = null
    this.lado = LADO_INICIAL
    this.historico = []
    this.chaoFixo = null
    this.mudou()
  }

  // --- Quadro a quadro -----------------------------------------------------------------

  private quadro = (_agora: number, frame?: XRFrame) => {
    const ref = this.renderer.xr.getReferenceSpace()
    if (!frame || !ref) return
    this.seguirAncora(frame, ref)
    const viewer = frame.getViewerPose(ref)
    if (viewer?.views[0]) this.lerProfundidade(frame, viewer.views[0])
    for (let i = 0; i < this.cortesPresos.length; i++)
      this.cortes[i].copy(this.cortesPresos[i]).applyMatrix4(this.preso.matrix)
    if (viewer) {
      const { position: p, orientation: o } = viewer.transform
      this.olho.set(p.x, p.y, p.z).applyMatrix4(this.paraPreso)
      this.frente
        .set(0, 0, -1)
        .applyQuaternion(new THREE.Quaternion(o.x, o.y, o.z, o.w))
        .transformDirection(this.paraPreso)
    }
    const acerto = this.fonte ? frame.getHitTestResults(this.fonte)[0] : undefined
    this.mirar(acerto?.getPose(ref) ?? null)
    this.desenhar()
    this.renderer.render(this.cena, this.camera)
  }

  /** Profundidade medida pelo aparelho (em metros), para os móveis esconderem o piso e a parede. */
  private lerProfundidade(frame: XRFrame, view: XRView) {
    const sessao = this.sessao
    if (!sessao || sessao.depthUsage !== 'cpu-optimized' || !frame.getDepthInformation) return
    let info: XRCPUDepthInformation | null | undefined
    try {
      info = frame.getDepthInformation(view)
    } catch {
      return
    }
    if (!info) return
    const { width: l, height: a } = info
    let tex = this.oclusao.uProf.value
    if (!tex || tex.image.width !== l || tex.image.height !== a) {
      tex?.dispose()
      this.dadosProf = new Float32Array(l * a)
      tex = new THREE.DataTexture(this.dadosProf, l, a, THREE.RedFormat, THREE.FloatType)
      tex.magFilter = tex.minFilter = THREE.NearestFilter
      this.oclusao.uProf.value = tex
    }
    const bruto = sessao.depthDataFormat === 'float32' ? new Float32Array(info.data) : new Uint16Array(info.data)
    const dados = this.dadosProf!
    const k = info.rawValueToMeters
    for (let i = 0; i < dados.length; i++) dados[i] = bruto[i] * k
    tex.needsUpdate = true
    this.oclusao.uProfMat.value.fromArray(info.normDepthBufferFromNormView.matrix)
    const camada = sessao.renderState.baseLayer
    if (camada) this.oclusao.uTela.value.set(camada.framebufferWidth, camada.framebufferHeight)
    if (!this.oclusao.uOcluir.value) {
      this.oclusao.uOcluir.value = 1
      this.emitir()
    }
  }

  /** O rastreamento se corrige com o tempo; a âncora diz quanto, e o que está preso vai junto. */
  private seguirAncora(frame: XRFrame, ref: XRReferenceSpace) {
    if (!this.ancora || !frame.trackedAnchors?.has(this.ancora)) return
    const pose = frame.getPose(this.ancora.anchorSpace, ref)
    if (!pose) return
    const atual = new THREE.Matrix4().fromArray(pose.transform.matrix)
    if (!this.poseInicial) this.poseInicial = atual.clone()
    this.preso.matrix.multiplyMatrices(atual, this.poseInicial.clone().invert())
    this.preso.matrixWorldNeedsUpdate = true
    this.paraPreso.copy(this.preso.matrix).invert()
  }

  private mirar(pose: XRPose | null) {
    const alvo = pose && this.classificar(pose)
    if (!alvo) {
      this.mira.valida = false
    } else {
      // Suaviza o tremido da detecção; um salto grande (outra superfície) vai direto.
      const salto = !this.mira.valida || this.mira.tipo !== alvo.tipo || this.mira.ponto.distanceTo(alvo.ponto) > 0.5
      if (salto) this.mira.ponto.copy(alvo.ponto)
      else this.mira.ponto.lerp(alvo.ponto, 0.35)
      this.mira.tipo = alvo.tipo
      this.mira.valida = true
    }
    this.alvo = this.alvoAtual()
    this.emitir()
  }

  /** Chão ou parede, pelo ângulo da superfície (nas coordenadas presas). Rampas e inclinados ficam de fora. */
  private classificar(pose: XRPose) {
    const m = new THREE.Matrix4().fromArray(pose.transform.matrix).premultiply(this.paraPreso)
    const ponto = new THREE.Vector3().setFromMatrixPosition(m)
    const normal = CIMA.clone().transformDirection(m)
    if (normal.y > 0.85) {
      if (this.chaoVisto == null || ponto.y < this.chaoVisto) this.chaoVisto = ponto.y
      return { ponto, tipo: 'chao' as const }
    }
    // Mirar na própria parede também serve: o canto fica no pé dela.
    if (Math.abs(normal.y) < 0.3) return { ponto, tipo: 'parede' as const }
    return null
  }

  private alvoAtual(): Alvo {
    const { valida, tipo, ponto } = this.mira
    if (!valida) return 'procurando'
    const chao = this.chaoFixo ?? this.chaoVisto
    if (tipo === 'chao' && chao != null && ponto.y > chao + ALTURA_MOVEL) return 'movel'
    this.cursor.copy(ponto)
    this.cursor.y = tipo === 'parede' || this.chaoFixo != null ? (chao ?? this.olho.y - ALTURA_OLHO) : ponto.y
    if (this.fechado || this.modo === 'piso') return 'pronto'
    const n = this.cantos.length
    if (n >= 3 && this.cursor.distanceTo(this.cantos[0]) < IMA_FECHAR) {
      this.cursor.copy(this.cantos[0])
      return 'fechar'
    }
    if (n >= 2) this.esquadrejar()
    return 'pronto'
  }

  /** Perto do ângulo reto com a parede anterior, o novo canto vai para o esquadro, com o mesmo comprimento. */
  private esquadrejar() {
    const n = this.cantos.length
    const a = this.cantos[n - 2]
    const b = this.cantos[n - 1]
    const antes = Math.atan2(b.z - a.z, b.x - a.x)
    const dx = this.cursor.x - b.x
    const dz = this.cursor.z - b.z
    const l = Math.hypot(dx, dz)
    if (l < 0.05) return
    const agora = Math.atan2(dz, dx)
    const reto = Math.round((agora - antes) / (Math.PI / 2)) * (Math.PI / 2) + antes
    let desvio = agora - reto
    desvio = Math.atan2(Math.sin(desvio), Math.cos(desvio))
    if (Math.abs(desvio) > ESQUADRO) return
    this.cursor.x = b.x + Math.cos(reto) * l
    this.cursor.z = b.z + Math.sin(reto) * l
  }

  /** Refaz o piso, as paredes e as marcas só quando algo muda (a mira anda quase todo quadro). */
  private desenhar() {
    const mirando = this.alvo === 'pronto' || this.alvo === 'fechar'
    const livre = mirando && !this.fechado
    const c = this.cursor
    const chave = [
      this.modo,
      this.alvo,
      this.fechado,
      this.cantos.length,
      this.lado.toFixed(3),
      this.centroPiso ? this.centroPiso.toArray().map((x) => x.toFixed(3)).join() : '',
      livre ? `${c.x.toFixed(3)},${c.y.toFixed(3)},${c.z.toFixed(3)}` : '',
    ].join('|')
    this.anel.visible = mirando
    if (mirando) {
      this.anel.position.set(c.x, c.y + 0.006, c.z)
      this.anel.scale.setScalar(this.alvo === 'fechar' ? 1.5 : 1)
    }
    if (chave === this.chaveDesenho) return
    this.chaveDesenho = chave

    const piso = this.modo === 'piso'
    const cantos = this.cantos
    const eixo = this.eixo()

    // O cômodo inteiro à vista: o piso também no modo parede, e as paredes já marcadas no modo piso.
    if (!piso && cantos.length >= 2) this.comParedes = true
    const verParedes = !piso || this.comParedes
    this.trocarGeometria(
      this.piso,
      this.centroPiso
        ? geometriaPiso(cantosDoQuadrado(this.centroPiso, this.lado, eixo), eixo)
        : new THREE.BufferGeometry(),
    )

    const segmentos: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 1; i < cantos.length; i++) segmentos.push([cantos[i - 1], cantos[i]])
    if (this.fechado && cantos.length >= 3) segmentos.push([cantos[cantos.length - 1], cantos[0]])
    this.cortarPiso(segmentos)
    let perimetro = 0
    for (const [a, b] of segmentos) perimetro += a.distanceTo(b)
    this.trocarGeometria(this.paredes, verParedes ? geometriaParedes(segmentos, this.altura) : new THREE.BufferGeometry())
    const nova: [THREE.Vector3, THREE.Vector3][] = livre && cantos.length ? [[cantos[cantos.length - 1], c.clone()]] : []
    this.trocarGeometria(
      this.paredeNova,
      piso ? new THREE.BufferGeometry() : geometriaParedes(nova, this.altura, perimetro),
    )

    // Amostra no chão antes de pôr o piso; poste na mira do modo parede.
    this.amostra.visible = piso && livre && !this.centroPiso
    if (this.amostra.visible) this.amostra.position.set(c.x, c.y + 0.004, c.z)
    this.poste.visible = !piso && livre
    if (this.poste.visible) {
      this.poste.position.copy(c)
      this.poste.scale.set(1, this.altura, 1)
    }

    // Contorno e cantos marcados, para a pessoa ver o que já fez.
    const linha = [...cantos]
    if (livre && cantos.length && !piso) linha.push(c.clone())
    if (this.fechado && cantos.length) linha.push(cantos[0])
    this.contorno.geometry.dispose()
    this.contorno.geometry = new THREE.BufferGeometry().setFromPoints(linha.map((p) => p.clone().setY(p.y + 0.008)))
    this.marcas.clear()
    cantos.forEach((p, i) => {
      const m = new THREE.Mesh(this.geoMarca, this.branco)
      m.rotation.x = -Math.PI / 2
      m.position.set(p.x, p.y + 0.008, p.z)
      if (i === 0 && this.alvo === 'fechar') m.scale.setScalar(1.6)
      m.renderOrder = 4
      this.marcas.add(m)
    })
  }

  /** Direção do piso e do rejunte: a da primeira parede marcada ou, antes dela, a do olhar ao pôr o piso. */
  private eixo() {
    const [a, b] = this.cantos
    if (!a || !b) return this.eixoPiso
    const d = new THREE.Vector2(b.x - a.x, b.z - a.z)
    return d.lengthSq() > 1e-6 ? d.normalize() : this.eixoPiso
  }

  /** Cada parede corta o piso do lado de fora (o lado oposto ao centro do piso). */
  private cortarPiso(segmentos: [THREE.Vector3, THREE.Vector3][]) {
    const dentro = this.centroPiso
    this.cortesPresos = []
    if (dentro)
      for (const [a, b] of segmentos) {
        const n = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize()
        const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(n, a)
        if (plano.distanceToPoint(dentro) < 0) plano.negate()
        this.cortesPresos.push(plano)
      }
    while (this.cortes.length < this.cortesPresos.length) this.cortes.push(new THREE.Plane())
    this.cortes.length = this.cortesPresos.length
    for (let i = 0; i < this.cortes.length; i++) this.cortes[i].copy(this.cortesPresos[i]).applyMatrix4(this.preso.matrix)
  }

  private trocarGeometria(m: THREE.Mesh, g: THREE.BufferGeometry) {
    m.geometry.dispose()
    m.geometry = g
  }

  // --- Toque ---------------------------------------------------------------------------

  private aoTocar = (e: XRInputSourceEvent) => {
    // Os dedos da pinça também geram toques: não contam.
    if (this.pinca || performance.now() - this.ultimaPinca < 400) return
    if (this.alvo !== 'pronto' && this.alvo !== 'fechar') return
    if (this.modo === 'parede' && this.fechado) return
    const ponto = this.cursor.clone()
    if (this.chaoFixo == null) {
      this.chaoFixo = ponto.y
      this.criarAncora(e.frame, ponto)
    }
    if (this.modo === 'piso') {
      // Pôr o piso, ou levar para onde a mira está.
      this.historico.push({ tipo: 'piso', antes: { centro: this.centroPiso, lado: this.lado } })
      if (!this.centroPiso) {
        this.eixoPiso.set(this.frente.x, this.frente.z)
        if (this.eixoPiso.lengthSq() < 1e-6) this.eixoPiso.set(1, 0)
        this.eixoPiso.normalize()
      }
      this.centroPiso = ponto
    } else if (this.alvo === 'fechar') {
      this.fechado = true
      this.historico.push({ tipo: 'fechar' })
    } else {
      this.cantos.push(ponto)
      this.historico.push({ tipo: 'canto' })
    }
    navigator.vibrate?.(12)
    this.mudou()
  }

  /** Dois dedos na tela aumentam ou diminuem o piso. */
  private aoPincar = (e: TouchEvent) => {
    if (e.touches.length < 2 || !this.centroPiso) return
    if ((e.target as Element).closest?.('[data-ui]')) return
    const [a, b] = [e.touches[0], e.touches[1]]
    const distancia = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (!this.pinca) {
      this.pinca = { distancia, lado: this.lado }
      this.historico.push({ tipo: 'piso', antes: { centro: this.centroPiso, lado: this.lado } })
      return
    }
    this.lado = THREE.MathUtils.clamp((this.pinca.lado * distancia) / this.pinca.distancia, LADO_MIN, LADO_MAX)
    this.mudou()
  }

  private aoSoltar = (e: TouchEvent) => {
    if (!this.pinca || e.touches.length >= 2) return
    this.pinca = null
    this.ultimaPinca = performance.now()
  }

  /** Âncora no primeiro canto. Sem suporte no aparelho, segue sem (pode derivar um pouco). */
  private criarAncora(frame: XRFrame, p: THREE.Vector3) {
    const ref = this.renderer.xr.getReferenceSpace()
    if (this.ancora || !ref || !frame.createAnchor) return
    const mundo = p.clone().applyMatrix4(this.preso.matrix)
    frame
      .createAnchor(new XRRigidTransform({ x: mundo.x, y: mundo.y, z: mundo.z }), ref)
      .then((a) => {
        if (!this.sessao) return a.delete()
        this.ancora = a
        this.poseInicial = null
      })
      .catch(() => {})
  }

  private mudou() {
    this.chaveDesenho = ''
    this.alvo = this.alvoAtual()
    this.emitir()
  }

  // --- Materiais -----------------------------------------------------------------------

  private trocarMapa(superficie: Superficie, mapa: THREE.CanvasTexture) {
    const antigo = this.mapas[superficie]
    this.mapas[superficie] = mapa
    const malhas = superficie === 'piso' ? [this.piso, this.amostra] : [this.paredes, this.paredeNova]
    for (const m of malhas) m.material.map = mapa
    antigo.dispose()
  }

  private emitir() {
    const estado: EstadoRA = {
      alvo: this.alvo,
      cantos: this.cantos.length,
      fechado: this.fechado,
      piso: !!this.centroPiso,
      lado: Math.round(this.lado * 10) / 10,
      oclusao: this.oclusao.uOcluir.value > 0,
    }
    const chave = JSON.stringify(estado)
    if (chave === this.emitido) return
    this.emitido = chave
    this.cb.aoEstado(estado)
  }

  private aoEncerrar = () => {
    this.descartar()
    this.cb.aoEncerrar()
  }

  private descartar() {
    this.renderer.setAnimationLoop(null)
    this.overlay.removeEventListener('touchstart', this.aoPincar)
    this.overlay.removeEventListener('touchmove', this.aoPincar)
    this.overlay.removeEventListener('touchend', this.aoSoltar)
    this.overlay.removeEventListener('touchcancel', this.aoSoltar)
    this.oclusao.uProf.value?.dispose()
    this.fonte?.cancel()
    this.fonte = null
    this.ancora?.delete()
    this.ancora = null
    this.sessao = null
    this.cena.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry && m.geometry !== this.geoMarca) m.geometry.dispose()
      const mat = m.material as THREE.Material | undefined
      if (mat && mat !== this.branco) {
        ;(mat as THREE.MeshStandardMaterial).alphaMap?.dispose()
        mat.dispose()
      }
    })
    this.geoMarca.dispose()
    this.branco.dispose()
    Object.values(this.mapas).forEach((t) => t.dispose())
    this.renderer.dispose()
  }
}

// --- iPhone: amostra no Quick Look -------------------------------------------------------

/**
 * Gera a amostra (piso de `lado` × `lado` m, ou parede de 3 m × pé-direito) e abre no Quick Look,
 * presa ao chão ou à parede. Precisa ser chamada dentro de um toque.
 */
export async function abrirQuickLook(superficie: Superficie, a: Acabamento, altura: number, lado = LADO_INICIAL) {
  const piso = superficie === 'piso'
  const [l, h] = piso ? [lado, lado] : [LARGURA_PAREDE, altura]
  const geometria = new THREE.PlaneGeometry(l, h)
  geometria.setAttribute('uv1', geometria.getAttribute('uv').clone())
  const uv = geometria.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * l, uv.getY(i) * h)

  const material = new THREE.MeshStandardMaterial({
    map: piso ? texturaPiso(a) : texturaParede(a),
    alphaMap: mascara(
      piso
        ? (u, v) => {
            // Borda esmaecida de ~15 cm, qualquer que seja o tamanho.
            const b = Math.min(0.2, 0.15 / l)
            return suave(0, b, u) * suave(0, b, 1 - u) * suave(0, b, v) * suave(0, b, 1 - v)
          }
        : (u, v) => suave(0, 0.06, u) * suave(0, 0.06, 1 - u) * suave(0, 0.04, 1 - v),
    ),
    // A luz do Quick Look é forte: piso brilhante demais vira uma mancha branca no meio.
    roughness: piso ? Math.max(0.6, asperezaPiso[a.piso]) : 0.9,
    transparent: true,
  })
  const malha = new THREE.Mesh(geometria, material)
  // No chão, deitado. Na parede, o Quick Look põe a frente (+Z) para fora da parede, com o centro no toque.
  if (piso) malha.rotation.x = -Math.PI / 2
  const cena = new THREE.Scene().add(malha)
  cena.updateMatrixWorld(true)

  const dados = await new USDZExporter().parseAsync(cena, {
    ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: piso ? 'horizontal' : 'vertical' } },
    quickLookCompatible: true,
    maxTextureSize: 2048,
  })
  geometria.dispose()
  material.map?.dispose()
  material.alphaMap?.dispose()
  material.dispose()

  const url = URL.createObjectURL(new Blob([dados], { type: 'model/vnd.usdz+zip' }))
  const link = document.createElement('a')
  link.rel = 'ar'
  // Tamanho real: sem pinça para aumentar ou diminuir.
  link.href = `${url}#allowsContentScaling=0`
  link.download = piso ? 'piso.usdz' : 'parede.usdz'
  link.appendChild(document.createElement('img'))
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
