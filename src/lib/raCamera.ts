import * as THREE from 'three'
import type { GraphModel } from '@tensorflow/tfjs-converter'
import type { Acabamento } from './ambiente'
import type { Superficie } from './raAcabamento'
import { desenharPiso, tamanhoPiso } from './texturasPiso'
import { desenharPapel, tamanhoPapel } from './texturasParede'

/*
 * Provador com a câmera ao vivo, para quem não tem RA no navegador (iPhone e Android sem ARCore).
 * A pessoa toca na parede (ou no chão) e o provador troca, na imagem, aquela superfície pelo
 * revestimento escolhido. Cada pixel recebe o desenho novo com o brilho que tinha: a sombra fica.
 * - Uma rede neural (DeepLab/ADE20K, 2,4 MB) diz o que é cada parte da imagem (parede, piso, teto,
 *   móveis). Carrega em segundo plano depois que a câmera abre e lê de novo a cada ~0,35 s. A área
 *   trocada é a que ela reconhece como o mesmo tipo de coisa do ponto tocado, ligada a ele sem
 *   atravessar contornos (só a parede tocada, não a de trás); a cor só tira o que é
 *   claramente outra coisa que ela deixou passar (um cabo, uma placa). Assim sombra, reflexo, rejunte e
 *   veio da madeira entram inteiros, e o teto, a mesa e o sofá ficam de fora.
 * - Sem a rede (celular fraco, sem internet), vale a cor: cada toque aprende cinco tons (o do toque,
 *   dois mais claros e dois mais escuros), e só a área ligada aos toques, sem atravessar contornos.
 * - Tocar de novo onde não pegou SOMA o ponto novo aos anteriores (até MAX_PONTOS).
 * - A borda não sai pixel a pixel: a máscara (numa imagem pequena) é "grudada" nos contornos da imagem
 *   por um filtro guiado no shader. Sai nítida no sofá e inteira no meio da parede.
 * - A imagem da câmera é lida pela placa de vídeo (readPixels), não por um canvas 2D: em parte dos
 *   Android o canvas 2D devolve o vídeo preto.
 * - A perspectiva do desenho vem do giroscópio: o chão fica a ALTURA_CELULAR abaixo do celular, e a
 *   parede a DISTANCIA_PAREDE à frente, virada para onde a pessoa tocou. Ele também mantém os toques
 *   e a área da rede no lugar quando o celular vira.
 */

export type EtapaCamera = 'camera' | 'pronto' | 'erro'
export type EstadoCamera = {
  etapa: EtapaCamera
  /** A rede que confere a área: ainda baixando, pronta, ou fora (sem ela, só a cor). */
  ia: 'carregando' | 'pronta' | 'indisponivel'
  /** Quantos pontos do chão / da parede a pessoa já tocou para ensinar a cor (0: nenhum). */
  piso: number
  parede: number
  /** Sem giroscópio: o desenho sai com uma perspectiva fixa, que pode não bater com a do cômodo. */
  semGiroscopio: boolean
}

/** Lado maior da imagem pequena usada para achar a área ligada ao toque. */
const PEQUENA = 288
const ALTURA_CELULAR = 1.4
const DISTANCIA_PAREDE = 3
/** Campo de visão do lado maior da câmera traseira (a principal de quase todo celular fica perto disso). */
const CAMPO_DE_VISAO = THREE.MathUtils.degToRad(64)
/** Pixels desenhados no lado maior da tela: acima da resolução da câmera (720p) não se ganha nada. */
const RESOLUCAO = 1280
/** Tolerância padrão da cor (distância de cromaticidade) e quanto o brilho pode variar (sombra, luz). */
export const TOLERANCIA_PADRAO = 0.5
const BRILHO_MIN = 0.45
const BRILHO_MAX = 1.8
/** Toques somados numa superfície; o mais antigo sai quando passa disso. */
const MAX_PONTOS = 4

const MODELO = `${import.meta.env.BASE_URL}modelos/deeplab-ade20k/model.json`
/**
 * Lado maior da imagem que vai para a rede. Ela trabalha num quadrado de 513 (a imagem menor é ampliada
 * até ele): mandar já em 513 dá todo o detalhe sem custar nada a mais.
 */
const ENTRADA_IA = 513
/** Saída usada: a pontuação de cada uma das 151 classes, numa grade de 129 × 129 (um ponto a cada 4 px). */
const SAIDA_IA = 'logits/semantic/BiasAdd'
const GRADE_IA = 129
const PASSO_IA = 4
/** A rede lê de novo a cada tanto (a área acompanha o celular). */
const INTERVALO_IA_MS = 250
/**
 * As leituras se somam (levadas de uma para a outra pelo giroscópio): um erro de um quadro só não vira
 * mancha. Peso da leitura nova na média.
 */
const PESO_LEITURA = 0.55
/** Probabilidade de ser a superfície tocada: a partir de PROB_DENTRO, vale; entre as duas, a cor decide. */
const PROB_DENTRO = 0.5
const PROB_BEIRADA = 0.2
/**
 * Dentro da área da rede, o que sai por ser claramente outra coisa: cor mais longe que OUTRA_COR × a
 * tolerância, ou brilho fora de BRILHO_FORA_MIN–BRILHO_FORA_MAX × o da superfície (o preto do pé de um
 * móvel, uma lâmpada acesa).
 */
const OUTRA_COR = 2
const BRILHO_FORA_MIN = 0.25
const BRILHO_FORA_MAX = 3
/** Na parede, mais folga (é o que a deixava sair inteira, de ponta a ponta do corredor). */
const OUTRA_COR_PAREDE = 2.5
const BRILHO_FORA_PAREDE = [0.12, 4] as const
/**
 * Contorno: onde o brilho (em log) ou a cor mudam mais rápido que isto por pixel, é a borda de alguma
 * coisa (a quina entre duas paredes, o alto da divisória, o lado de um totem), e o preenchimento não
 * passa. Só a superfície tocada é pintada, não toda parede que a rede vê. A sombra e o degradê da luz
 * mudam devagar e passam. No piso, mais folga: o rejunte e o veio da madeira não podem cortar a área.
 */
const CONTORNO_LUZ = { piso: 0.2, parede: 0.09 }
const CONTORNO_COR = { piso: 0.03, parede: 0.012 }
/** Buracos dentro da área até esta fração da imagem são fechados; com a rede confirmando, até BURACO_REDE. */
const BURACO = 0.004
const BURACO_REDE = 0.05
/**
 * Filtro guiado no shader: a máscara pequena é "grudada" nos contornos da imagem. SIGMA_COR é quanto a
 * cor (0–1) pode mudar e ainda contar como o mesmo lado da borda.
 */
const SIGMA_COR = 0.07

let modeloCarregado: Promise<GraphModel> | null = null

/** A rede é carregada uma vez só e fica para as próximas aberturas. */
function carregarModelo() {
  modeloCarregado ??= (async () => {
    const tf = await import('@tensorflow/tfjs-core')
    await import('@tensorflow/tfjs-backend-webgl')
    const { loadGraphModel } = await import('@tensorflow/tfjs-converter')
    // Números de 16 bits na placa de vídeo: bem mais rápido no celular, e sobra precisão para dizer
    // a probabilidade de cada classe.
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true)
    await tf.setBackend('webgl')
    await tf.ready()
    const modelo = await loadGraphModel(MODELO)
    // A primeira rodada compila os programas da placa: feita agora, não quando a pessoa tocar.
    const zeros = tf.zeros([1, Math.round((ENTRADA_IA * 9) / 16), ENTRADA_IA, 3], 'int32')
    const r = tf.tidy(() => tf.softmax(modelo.execute(zeros, SAIDA_IA) as import('@tensorflow/tfjs-core').Tensor))
    await r.data()
    zeros.dispose()
    r.dispose()
    return modelo
  })()
  modeloCarregado.catch(() => (modeloCarregado = null))
  return modeloCarregado
}

/**
 * Leitura da rede: a classe vencedora em cada ponto da grade dela (linhas × colunas, um ponto a cada
 * PASSO_IA pixels da imagem de l × a que ela leu) e para onde o celular apontava.
 */
type LeituraIA = { classes: Int32Array; linhas: number; colunas: number; l: number; a: number; rot: THREE.Matrix3 }

/**
 * Probabilidade de cada ponto da grade ser a superfície (a soma das classes dos toques), já somada às
 * leituras anteriores. `chave`: as classes; se mudam, recomeça.
 */
type MapaIA = Omit<LeituraIA, 'classes'> & { prob: Float32Array; chave: string }

/** Valor (bilinear) da grade na posição de grade (gc, gr); -1 se cair fora dela. */
function lerGrade(v: Float32Array, linhas: number, colunas: number, gc: number, gr: number) {
  if (gc < -0.5 || gr < -0.5 || gc > colunas - 0.5 || gr > linhas - 0.5) return -1
  const x = Math.min(Math.max(gc, 0), colunas - 1)
  const y = Math.min(Math.max(gr, 0), linhas - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, colunas - 1)
  const y1 = Math.min(y0 + 1, linhas - 1)
  const fx = x - x0
  const fy = y - y0
  const cima = v[y0 * colunas + x0] * (1 - fx) + v[y0 * colunas + x1] * fx
  const baixo = v[y1 * colunas + x0] * (1 - fx) + v[y1 * colunas + x1] * fx
  return cima * (1 - fy) + baixo * fy
}

/** sRGB (0–255) para luz linear, em tabela. */
const LINEAR = Float32Array.from({ length: 256 }, (_, i) => (i / 255) ** 2.2)
const EIXO_X = new THREE.Vector3(1, 0, 0)
const EIXO_Z = new THREE.Vector3(0, 0, 1)
/** Cromaticidade do cinza (branco, preto): para onde o reflexo puxa qualquer cor. */
const NEUTRO = new THREE.Vector3(1 / 3, 1 / 3, 1 / 3)

/**
 * Os tons de uma superfície, a partir dos pixels (RGBA) em volta do toque: a média, a do quarto mais
 * claro e a do quarto mais escuro, e mais dois além deles (o reflexo forte, quase branco, e a sombra
 * funda). Pixels de outra cor (a borda de um móvel no meio da amostra) ficam de fora. Mesmo numa
 * amostra lisa, os tons se afastam um mínimo da média: o reflexo puxa a cor para o branco, a sombra
 * deixa mais escuro e um pouco mais saturado.
 */
function aprenderCores(dados: Uint8Array): Cor[] {
  type Px = { r: number; g: number; b: number; luz: number }
  const px: Px[] = []
  for (let i = 0; i < dados.length; i += 4) {
    const r = LINEAR[dados[i]]
    const g = LINEAR[dados[i + 1]]
    const b = LINEAR[dados[i + 2]]
    px.push({ r, g, b, luz: 0.2126 * r + 0.7152 * g + 0.0722 * b })
  }
  const croma = (p: Px) => {
    const soma = Math.max(p.r + p.g + p.b, 1e-4)
    return new THREE.Vector3(p.r / soma, p.g / soma, p.b / soma)
  }
  const media = (lista: Px[]): Cor => {
    const m = { r: 0, g: 0, b: 0, luz: 0 }
    for (const p of lista) {
      m.r += p.r
      m.g += p.g
      m.b += p.b
      m.luz += p.luz
    }
    m.luz /= Math.max(lista.length, 1)
    return { croma: croma(m), luz: m.luz }
  }
  const variar = (c: Cor, puxarNeutro: number, luz: number): Cor => ({
    croma: c.croma.clone().lerp(NEUTRO, puxarNeutro),
    luz,
  })
  // A cor do centro decide quem é da superfície (a mediana resiste a uma borda de outra cor).
  const mediana = (k: 'r' | 'g' | 'b') => px.map((p) => p[k]).sort((x, y) => x - y)[px.length >> 1]
  const centro = croma({ r: mediana('r'), g: mediana('g'), b: mediana('b'), luz: 0 })
  let iguais = px.filter((p) => croma(p).distanceTo(centro) * 12 < TOLERANCIA_PADRAO)
  if (iguais.length < px.length / 4) iguais = px
  iguais.sort((x, y) => x.luz - y.luz)
  const quarto = Math.max(1, Math.round(iguais.length / 4))
  const base = media(iguais)
  const clara = media(iguais.slice(-quarto))
  const escura = media(iguais.slice(0, quarto))
  return [
    base,
    // Pouco puxado para o cinza: mais que isso, móvel branco ou cinza passa por parede clara.
    variar(clara, 0.08, Math.max(clara.luz, base.luz * 1.5)),
    variar(escura, -0.08, Math.min(escura.luz, base.luz * 0.6)),
    variar(clara, 0.18, base.luz * 2.6),
    variar(escura, -0.15, base.luz * 0.3),
  ]
}

/**
 * Faixa de brilho dos toques: o quarto mais escuro e o mais claro de cada um (os tons 1 e 2). Os tons
 * extremos (3 e 4) servem só para a cor; pelo brilho deles, o teto escuro passava por parede branca,
 * já que branco, cinza e preto têm a mesma cromaticidade.
 */
function faixaLuz(pontos: { cores: Cor[] }[]): [number, number] {
  let min = Infinity
  let max = 0
  for (const p of pontos) {
    min = Math.min(min, p.cores[2].luz, p.cores[0].luz)
    max = Math.max(max, p.cores[1].luz, p.cores[0].luz)
  }
  return [Math.max(min, 1e-4), Math.max(max, 1e-4)]
}

/**
 * Permissão do giroscópio no iPhone: só pode ser pedida dentro do toque, antes de qualquer espera.
 * Chame no clique e passe a promessa para o provador.
 */
export function pedirGiroscopio(): Promise<boolean> {
  const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  if (!D) return Promise.resolve(false)
  if (!D.requestPermission) return Promise.resolve(true)
  return D.requestPermission()
    .then((r) => r === 'granted')
    .catch(() => false)
}

export const cameraDisponivel = () => !!navigator.mediaDevices?.getUserMedia

const vertice = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

/*
 * A área de cada superfície vem da CPU numa máscara pequena (r: piso, g: parede). Aqui ela é "grudada"
 * nos contornos da imagem por um filtro guiado (bilateral conjunto): cada pixel pega a média da máscara
 * em volta, pesando mais os vizinhos da mesma cor que ele. A borda do sofá sai nítida e o meio da
 * parede sai inteiro, sem as manchas que um teste de cor pixel a pixel deixa.
 */
const fragmento = /* glsl */ `
uniform sampler2D uVideo;
uniform sampler2D uArea;
uniform sampler2D uReduzido;
uniform sampler2D uPiso;
uniform sampler2D uParede;
uniform vec2 uCobrir;
uniform vec2 uTan;
uniform mat3 uRot;
uniform float uAltura;
uniform float uDistancia;
uniform vec3 uNormal;
uniform float uGiro;
uniform float uTamPiso;
uniform float uTamParede;
// x: brilho médio dos toques (a referência da sombra).
uniform vec3 uLuzPiso;
uniform vec3 uLuzParede;
uniform float uVerPiso;
uniform float uVerParede;
uniform float uMostrar;
uniform float uCortarTeto;
uniform vec2 uPassoArea;
varying vec2 vUv;

vec3 linear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 tela(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
float luz(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 v = (vUv - 0.5) * uCobrir + 0.5;
  vec3 bruto = texture2D(uVideo, v).rgb;
  vec3 c = linear(bruto);
  float l = luz(c);
  vec3 raio = uRot * vec3((v.x - 0.5) * 2.0 * uTan.x, (v.y - 0.5) * 2.0 * uTan.y, -1.0);

  // Filtro guiado: 5×5 vizinhos da máscara, pesados pela semelhança de cor (com o vídeo reduzido, que
  // tem a mesma grade da máscara) e pela distância. Linhas de cima para baixo.
  vec2 pa = vec2(v.x, 1.0 - v.y);
  vec2 soma = vec2(0.0);
  float peso = 0.0;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) {
      vec2 o = pa + vec2(float(i), float(j)) * uPassoArea;
      vec3 dc = texture2D(uReduzido, o).rgb - bruto;
      float w = exp(-dot(dc, dc) * ${(1 / (2 * SIGMA_COR * SIGMA_COR)).toFixed(2)} - float(i * i + j * j) * 0.22) + 0.002;
      soma += texture2D(uArea, o).rg * w;
      peso += w;
    }
  vec2 area = soma / peso;
  vec3 saida = c;

  if (uVerPiso > 0.5 && raio.y < -0.015) {
    float m = smoothstep(0.35, 0.65, area.x);
    float t = uAltura / -raio.y;
    vec3 p = raio * t;
    float cg = cos(uGiro), sg = sin(uGiro);
    vec2 q = vec2(cg * p.x - sg * p.z, sg * p.x + cg * p.z) / uTamPiso;
    vec3 desenho = linear(texture2D(uPiso, q).rgb);
    // A sombra e a luz do cômodo continuam no desenho novo (o reflexo forte, só como um realce).
    float s = clamp(l / uLuzPiso.x, 0.25, 1.6);
    saida = mix(saida, desenho * s, m * uMostrar * (1.0 - smoothstep(9.0, 15.0, t)));
  }
  if (uVerParede > 0.5) {
    float m = smoothstep(0.35, 0.65, area.y);
    // Sem a rede, o teto (quase sempre da cor da parede) é cortado pelo ângulo: o que está bem acima da
    // linha dos olhos (mais de ~35°) não conta.
    m *= 1.0 - uCortarTeto * smoothstep(0.53, 0.67, raio.y / length(raio));
    vec3 frente = -uNormal;
    float d = dot(raio, frente);
    vec3 lado = vec3(-uNormal.z, 0.0, uNormal.x);
    vec3 p = raio * (uDistancia / max(d, 0.05));
    vec2 q = vec2(dot(p, lado), p.y + uAltura) / uTamParede;
    vec3 desenho = linear(texture2D(uParede, q).rgb);
    float s = clamp(l / uLuzParede.x, 0.25, 1.6);
    saida = mix(saida, desenho * s, m * uMostrar);
  }
  gl_FragColor = vec4(tela(saida), 1.0);
}`

/*
 * O vídeo reduzido para a CPU (área ligada ao toque e entrada da rede): média de 3×3 amostras por
 * pixel, para a imagem pequena não sair granulada. Linhas de cima para baixo, como num canvas.
 */
const fragmentoReduzido = /* glsl */ `
uniform sampler2D uVideo;
uniform vec2 uPasso;
varying vec2 vUv;
void main() {
  vec2 v = vec2(vUv.x, 1.0 - vUv.y);
  vec3 c = vec3(0.0);
  for (int i = -1; i <= 1; i++)
    for (int j = -1; j <= 1; j++) c += texture2D(uVideo, v + vec2(float(i), float(j)) * uPasso / 3.0).rgb;
  gl_FragColor = vec4(c / 9.0, 1.0);
}`

/** Lado das texturas no celular: 512 basta para o que a câmera mostra e gera 4× mais rápido. */
const LADO_TEXTURA = 512
const desenhos = new Map<string, HTMLCanvasElement>()
/** Cada piso/revestimento é desenhado uma vez só: trocar de volta para um já visto é instantâneo. */
const desenho = (chave: string, fazer: () => HTMLCanvasElement) => {
  let c = desenhos.get(chave)
  if (!c) desenhos.set(chave, (c = fazer()))
  return c
}
const desenhoPiso = (a: Acabamento) =>
  desenho(`piso${a.piso}${a.corPiso}`, () => desenharPiso(a.piso, a.corPiso, LADO_TEXTURA))
const desenhoParede = (a: Acabamento) =>
  desenho(`parede${a.papel}${a.paredes}`, () => desenharPapel(a.papel, a.paredes, LADO_TEXTURA))

const mapa = (canvas: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

/** Uma cor aprendida: cromaticidade (r, g, b somando 1) e brilho. */
type Cor = { croma: THREE.Vector3; luz: number }

/** Um toque: os tons aprendidos ali e a direção (no mundo) do ponto tocado. */
type Ponto = {
  cores: Cor[]
  semente: THREE.Vector3
  /** Classe da rede no ponto tocado (parede, piso, mesa…): decidida na primeira leitura depois do toque. */
  classe?: number
  /** Quando foi tocado (performance.now). */
  criado: number
}

/** Uma superfície: os toques somados (as áreas deles viram uma só) e a tolerância. */
type Amostra = {
  pontos: Ponto[]
  tolerancia: number
  /** Onde a rede vê a superfície (somando as leituras). */
  mapa?: MapaIA
}

/** Uma leitura do vídeo pela placa: a imagem reduzida, com as linhas de cima para baixo. */
type Quadro = { pixels: Uint8Array; l: number; a: number }

type Callbacks = { aoEstado: (e: EstadoCamera) => void }

export class ProvadorCamera {
  private renderer: THREE.WebGLRenderer
  private cena = new THREE.Scene()
  private camera = new THREE.Camera()
  private video = document.createElement('video')
  private fluxo: MediaStream | null = null
  private material: THREE.ShaderMaterial
  private area: THREE.DataTexture
  private dadosArea = new Uint8Array(0)
  /** A área do quadro anterior: com o celular parado, as duas se somam e a borda não pisca. */
  private areaAnterior = new Uint8Array(0)
  /** Leitura do vídeo pela placa (uma imagem pequena por tamanho pedido). */
  private reduzido: THREE.ShaderMaterial
  private cenaReduzida = new THREE.Scene()
  private alvos = new Map<number, THREE.WebGLRenderTarget>()
  private ativo = true
  private acabamento: Acabamento
  private estado: EstadoCamera = { etapa: 'camera', ia: 'carregando', piso: 0, parede: 0, semGiroscopio: true }
  private modelo: GraphModel | null = null
  private leitura: LeituraIA | null = null
  /** Pede uma leitura da rede logo (depois de um toque). */
  private pedidoIA = false
  private ultimaIA = 0
  private rotAnterior = new THREE.Matrix3()
  private paradoDesde = 0
  private orientacao: { alpha: number; beta: number; gamma: number } | null = null
  private giroscopio: Promise<boolean>
  private cb: Callbacks
  private container: HTMLElement
  private observador: ResizeObserver
  private amostras: Partial<Record<Superficie, Amostra>> = {}
  private modo: Superficie = 'piso'
  private ultimaArea = 0

  /** `giroscopio`: a promessa de `pedirGiroscopio`, pedida no toque. */
  constructor(container: HTMLElement, acabamento: Acabamento, giroscopio: Promise<boolean>, cb: Callbacks) {
    this.container = container
    this.acabamento = acabamento
    this.giroscopio = giroscopio
    this.cb = cb
    this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
    // Desenha mais ou menos na resolução da câmera, não na da tela (que no celular é 3× maior).
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, RESOLUCAO / Math.max(window.innerWidth, window.innerHeight, 1)),
    )
    this.renderer.domElement.className = 'block size-full'
    container.appendChild(this.renderer.domElement)

    this.video.playsInline = true
    this.video.muted = true
    this.video.setAttribute('playsinline', '')

    this.area = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat)
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertice,
      fragmentShader: fragmento,
      depthTest: false,
      uniforms: {
        uVideo: { value: new THREE.VideoTexture(this.video) },
        uArea: { value: this.area },
        uReduzido: { value: null },
        uPiso: { value: mapa(desenhoPiso(acabamento)) },
        uParede: { value: mapa(desenhoParede(acabamento)) },
        uCobrir: { value: new THREE.Vector2(1, 1) },
        uTan: { value: new THREE.Vector2(1, 1) },
        uRot: { value: new THREE.Matrix3() },
        uAltura: { value: ALTURA_CELULAR },
        uDistancia: { value: DISTANCIA_PAREDE },
        uNormal: { value: new THREE.Vector3(0, 0, 1) },
        uGiro: { value: 0 },
        uTamPiso: { value: tamanhoPiso[acabamento.piso] },
        uTamParede: { value: tamanhoPapel[acabamento.papel] },
        uLuzPiso: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
        uLuzParede: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
        uVerPiso: { value: 0 },
        uVerParede: { value: 0 },
        uMostrar: { value: 1 },
        uCortarTeto: { value: 1 },
        uPassoArea: { value: new THREE.Vector2(1, 1) },
      },
    })
    this.cena.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material))
    this.reduzido = new THREE.ShaderMaterial({
      vertexShader: vertice,
      fragmentShader: fragmentoReduzido,
      depthTest: false,
      uniforms: { uVideo: this.material.uniforms.uVideo, uPasso: { value: new THREE.Vector2(1, 1) } },
    })
    this.cenaReduzida.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.reduzido))

    this.observador = new ResizeObserver(() => this.redimensionar())
    this.observador.observe(container)
    window.addEventListener('deviceorientation', this.aoGirar)
  }

  async iniciar(modo: Superficie) {
    this.definirModo(modo)
    try {
      this.fluxo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
    } catch {
      return this.emitir({ etapa: 'erro' })
    }
    if (!this.ativo) return this.parar()
    this.video.srcObject = this.fluxo
    await this.video.play().catch(() => {})
    this.renderer.setAnimationLoop(this.quadro)
    this.giroscopio.then((ok) => {
      // Sem permissão ou sem sensor, o primeiro evento nunca chega.
      if (!ok) this.emitir({ semGiroscopio: true })
    })
    this.emitir({ etapa: 'pronto' })
    // A rede vem depois, sem atrasar a câmera: a pessoa já pode tocar e ver a troca pela cor.
    setTimeout(() => this.ativo && this.carregarIA(), 600)
  }

  private async carregarIA() {
    try {
      this.modelo = await carregarModelo()
    } catch {
      return this.emitir({ ia: 'indisponivel' })
    }
    if (!this.ativo) return
    this.emitir({ ia: 'pronta' })
    const tf = await import('@tensorflow/tfjs-core')
    while (this.ativo) {
      const agora = performance.now()
      const temAmostra = !!(this.amostras.piso || this.amostras.parede)
      if (temAmostra && (this.pedidoIA || agora - this.ultimaIA > INTERVALO_IA_MS)) {
        this.pedidoIA = false
        this.ultimaIA = agora
        try {
          await this.lerIA(tf)
        } catch {
          // Uma leitura que falha não para nada: a cor continua valendo.
        }
      }
      await new Promise((r) => setTimeout(r, 60))
    }
  }

  /**
   * Uma leitura da rede na imagem atual da câmera: a classe vencedora em cada ponto (para saber o que foi
   * tocado) e, para cada superfície, a probabilidade de ser ela, somada às leituras anteriores.
   */
  private async lerIA(tf: typeof import('@tensorflow/tfjs-core')) {
    const modelo = this.modelo
    if (!modelo) return
    const quadro = this.lerQuadro(ENTRADA_IA)
    if (!quadro) return
    const { pixels, l, a } = quadro
    const rgb = new Int32Array(l * a * 3)
    for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
      rgb[j] = pixels[i]
      rgb[j + 1] = pixels[i + 1]
      rgb[j + 2] = pixels[i + 2]
    }
    const rot = (this.material.uniforms.uRot.value as THREE.Matrix3).clone()
    // Só a parte da grade que cobre a imagem (o resto do quadrado de 513 é enchimento).
    const linhas = Math.min(GRADE_IA, Math.floor((a - 1) / PASSO_IA) + 1)
    const colunas = Math.min(GRADE_IA, Math.floor((l - 1) / PASSO_IA) + 1)
    const x = tf.tensor(rgb, [1, a, l, 3], 'int32')
    const prob = tf.tidy(() => {
      const logits = modelo.execute(x, SAIDA_IA) as import('@tensorflow/tfjs-core').Tensor4D
      return tf.softmax(tf.squeeze(tf.slice(logits, [0, 0, 0, 0], [1, linhas, colunas, -1]), [0]))
    })
    x.dispose()
    try {
      const vencedora = tf.argMax(prob, 2)
      const classes = (await vencedora.data()) as Int32Array
      vencedora.dispose()
      if (!this.ativo) return
      this.leitura = { classes, linhas, colunas, l, a, rot }
      // Toques ainda sem classe: a rede diz agora o que tem no ponto tocado.
      for (const s of ['piso', 'parede'] as const)
        for (const p of this.amostras[s]?.pontos ?? []) if (p.classe == null) p.classe = this.classeNoPonto(p.semente)

      for (const s of ['piso', 'parede'] as const) {
        const amostra = this.amostras[s]
        if (!amostra) continue
        const alvo = [...new Set(amostra.pontos.flatMap((p) => (p.classe == null ? [] : [p.classe])))].sort((i, j) => i - j)
        if (!alvo.length) continue
        const soma = tf.tidy(() => tf.sum(tf.gather(prob, tf.tensor1d(alvo, 'int32'), 2), 2))
        const novo = Float32Array.from((await soma.data()) as Float32Array)
        soma.dispose()
        // A pessoa pode ter limpado ou trocado a superfície enquanto a rede lia.
        if (!this.ativo || this.amostras[s] !== amostra) continue
        amostra.mapa = this.fundir(amostra.mapa, { prob: novo, linhas, colunas, l, a, rot, chave: alvo.join() })
      }
    } finally {
      prob.dispose()
    }
    // Com a rede, o teto já fica de fora por ela.
    this.material.uniforms.uCortarTeto.value = this.amostras.parede?.mapa ? 0 : 1
    this.ultimaArea = 0
  }

  /**
   * Soma a leitura nova às anteriores: cada ponto da grade nova é levado (pelo giroscópio) para a grade
   * antiga, e as duas probabilidades fazem média. Onde a antiga não via, vale só a nova.
   */
  private fundir(antigo: MapaIA | undefined, novo: MapaIA) {
    if (!antigo || antigo.chave !== novo.chave || antigo.l !== novo.l || antigo.a !== novo.a) return novo
    const tan = this.material.uniforms.uTan.value as THREE.Vector2
    const m = new THREE.Matrix3().copy(antigo.rot).transpose().multiply(novo.rot).elements
    for (let r = 0; r < novo.linhas; r++)
      for (let c = 0; c < novo.colunas; c++) {
        const cx = (((c * PASSO_IA + 0.5) / novo.l) - 0.5) * 2 * tan.x
        const cy = (0.5 - (r * PASSO_IA + 0.5) / novo.a) * 2 * tan.y
        const ox = m[0] * cx + m[3] * cy - m[6]
        const oy = m[1] * cx + m[4] * cy - m[7]
        const oz = m[2] * cx + m[5] * cy - m[8]
        if (oz > -0.01) continue
        const gc = (((ox / -oz / tan.x) * 0.5 + 0.5) * antigo.l - 0.5) / PASSO_IA
        const gr = ((0.5 - (oy / -oz / tan.y) * 0.5) * antigo.a - 0.5) / PASSO_IA
        const velho = lerGrade(antigo.prob, antigo.linhas, antigo.colunas, gc, gr)
        if (velho < 0) continue
        const k = r * novo.colunas + c
        novo.prob[k] = novo.prob[k] * PESO_LEITURA + velho * (1 - PESO_LEITURA)
      }
    return novo
  }

  /** A classe que mais aparece em volta da direção `semente`, na última leitura da rede. */
  private classeNoPonto(semente: THREE.Vector3) {
    const leitura = this.leitura
    if (!leitura) return undefined
    const tan = this.material.uniforms.uTan.value as THREE.Vector2
    const cam = semente.clone().applyMatrix3(leitura.rot.clone().transpose())
    if (cam.z > -0.01) return undefined
    const vx = (cam.x / -cam.z / tan.x) * 0.5 + 0.5
    const vy = (cam.y / -cam.z / tan.y) * 0.5 + 0.5
    const cx = Math.round((vx * leitura.l - 0.5) / PASSO_IA)
    const cy = Math.round(((1 - vy) * leitura.a - 0.5) / PASSO_IA)
    const contagem = new Map<number, number>()
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= leitura.colunas || y >= leitura.linhas) continue
        const c = leitura.classes[y * leitura.colunas + x]
        // O ponto do meio conta mais.
        contagem.set(c, (contagem.get(c) ?? 0) + (dx || dy ? 1 : 3))
      }
    let melhor: number | undefined
    let maximo = 0
    for (const [c, n] of contagem)
      if (n > maximo) {
        maximo = n
        melhor = c
      }
    return melhor
  }

  encerrar() {
    this.ativo = false
    this.parar()
    this.observador.disconnect()
    window.removeEventListener('deviceorientation', this.aoGirar)
    this.renderer.setAnimationLoop(null)
    const u = this.material.uniforms
    for (const t of [u.uVideo.value, u.uPiso.value, u.uParede.value, this.area] as THREE.Texture[]) t.dispose()
    for (const alvo of this.alvos.values()) alvo.dispose()
    this.material.dispose()
    this.reduzido.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  definirModo(modo: Superficie) {
    this.modo = modo
  }

  definirAcabamento(a: Acabamento) {
    const antes = this.acabamento
    this.acabamento = a
    const u = this.material.uniforms
    if (a.piso !== antes.piso || a.corPiso !== antes.corPiso) {
      u.uPiso.value.dispose()
      u.uPiso.value = mapa(desenhoPiso(a))
      u.uTamPiso.value = tamanhoPiso[a.piso]
    }
    if (a.papel !== antes.papel || a.paredes !== antes.paredes) {
      u.uParede.value.dispose()
      u.uParede.value = mapa(desenhoParede(a))
      u.uTamParede.value = tamanhoPapel[a.papel]
    }
  }

  /** Segurar "comparar" mostra a câmera sem nada aplicado. */
  mostrar(visivel: boolean) {
    this.material.uniforms.uMostrar.value = visivel ? 1 : 0
  }

  /** Quanto a cor pode variar e ainda contar como a superfície do modo atual. */
  definirTolerancia(t: number) {
    const a = this.amostras[this.modo]
    if (a) a.tolerancia = t
    this.ultimaArea = 0
  }

  tolerancia() {
    return this.amostras[this.modo]?.tolerancia ?? TOLERANCIA_PADRAO
  }

  /**
   * Aprende a cor da superfície do modo atual no ponto tocado (`x`, `y` de 0 a 1 na tela, de cima
   * para baixo), pela média de uma pequena área em volta, e passa a trocar aquela cor.
   */
  escolher(x: number, y: number) {
    this.ajustarVideo()
    const quadro = this.lerQuadro(PEQUENA)
    if (!quadro) return
    const u = this.material.uniforms
    // Da tela para a imagem da câmera (que cobre a tela) e para a direção no mundo.
    const vx = (x - 0.5) * u.uCobrir.value.x + 0.5
    const vy = (0.5 - y) * u.uCobrir.value.y + 0.5
    const semente = new THREE.Vector3((vx - 0.5) * 2 * u.uTan.value.x, (vy - 0.5) * 2 * u.uTan.value.y, -1)
      .applyMatrix3(u.uRot.value)
      .normalize()

    // Os pixels em volta do toque.
    const { pixels, l, a } = quadro
    const px = Math.round(vx * (l - 1))
    const py = Math.round((1 - vy) * (a - 1))
    const raio = 7
    const recorte: number[] = []
    for (let yy = Math.max(0, py - raio); yy <= Math.min(a - 1, py + raio); yy++)
      for (let xx = Math.max(0, px - raio); xx <= Math.min(l - 1, px + raio); xx++) {
        const k = (yy * l + xx) * 4
        recorte.push(pixels[k], pixels[k + 1], pixels[k + 2], 255)
      }
    if (!recorte.length) return

    const piso = this.modo === 'piso'
    const amostra = (this.amostras[this.modo] ??= { pontos: [], tolerancia: TOLERANCIA_PADRAO })
    amostra.pontos.push({ cores: aprenderCores(Uint8Array.from(recorte)), semente, criado: performance.now() })
    if (amostra.pontos.length > MAX_PONTOS) amostra.pontos.shift()
    this.pedidoIA = true
    if (!piso) u.uCortarTeto.value = 1
    this.enviarCores(this.modo)
    u[piso ? 'uVerPiso' : 'uVerParede'].value = 1
    // A parede fica de frente para onde a pessoa tocou primeiro; o rejunte do piso segue a mesma direção.
    if ((!piso && amostra.pontos.length === 1) || (piso && !this.amostras.parede && amostra.pontos.length === 1))
      this.alinharParede(semente)
    navigator.vibrate?.(12)
    this.ultimaArea = 0
    this.emitir({ [this.modo]: amostra.pontos.length })
  }

  /** O brilho de referência (média dos tons centrais dos toques) vai para o shader: a sombra fica. */
  private enviarCores(s: Superficie) {
    const amostra = this.amostras[s]
    if (!amostra?.pontos.length) return
    const base = amostra.pontos.reduce((t, p) => t + p.cores[0].luz, 0) / amostra.pontos.length
    const [min, max] = faixaLuz(amostra.pontos)
    this.material.uniforms[s === 'piso' ? 'uLuzPiso' : 'uLuzParede'].value.set(base, min, max)
  }

  /** Esquece as cores aprendidas da superfície do modo atual. */
  limpar() {
    delete this.amostras[this.modo]
    const piso = this.modo === 'piso'
    this.enviarCores(this.modo)
    this.material.uniforms[piso ? 'uVerPiso' : 'uVerParede'].value = 0
    this.emitir({ [this.modo]: 0 })
  }

  /** Tira o último toque da superfície do modo atual (o primeiro sair é o mesmo que limpar). */
  desfazer() {
    const amostra = this.amostras[this.modo]
    if (!amostra || amostra.pontos.length <= 1) return this.limpar()
    amostra.pontos.pop()
    // Pede uma leitura logo: o mapa da rede (das classes de todos os toques) recomeça com as que ficaram.
    this.pedidoIA = true
    this.enviarCores(this.modo)
    this.ultimaArea = 0
    navigator.vibrate?.(8)
    this.emitir({ [this.modo]: amostra.pontos.length })
  }

  /** Foto do que está na tela (com o piso e a parede novos). */
  capturar(): Promise<Blob | null> {
    this.renderer.render(this.cena, this.camera)
    return new Promise((r) => this.renderer.domElement.toBlob(r, 'image/jpeg', 0.92))
  }

  private alinharParede(direcao: THREE.Vector3) {
    const frente = direcao.clone().setY(0)
    if (frente.lengthSq() < 1e-4) return
    frente.normalize()
    this.material.uniforms.uNormal.value.copy(frente).negate()
    this.material.uniforms.uGiro.value = Math.atan2(frente.x, frente.z)
  }

  // --- Quadro a quadro ------------------------------------------------------------------

  private quadro = (agora: number) => {
    this.atualizarRotacao()
    const rot = this.material.uniforms.uRot.value as THREE.Matrix3
    const mexeu = rot.elements.some((x, i) => Math.abs(x - this.rotAnterior.elements[i]) > 0.004)
    if (mexeu) this.paradoDesde = 0
    else if (!this.paradoDesde) this.paradoDesde = agora
    this.rotAnterior.copy(rot)
    // A área ligada ao toque é refeita ~15 vezes por segundo (é a parte que roda na CPU).
    if ((this.amostras.piso || this.amostras.parede) && agora - this.ultimaArea > 66) {
      this.ultimaArea = agora
      this.atualizarArea(agora)
    }
    this.renderer.render(this.cena, this.camera)
  }

  private aoGirar = (e: DeviceOrientationEvent) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return
    const primeira = !this.orientacao
    this.orientacao = { alpha: e.alpha, beta: e.beta, gamma: e.gamma }
    if (primeira) this.emitir({ semGiroscopio: false })
  }

  private q = new THREE.Quaternion()
  private q2 = new THREE.Quaternion()
  private euler = new THREE.Euler()
  private m4 = new THREE.Matrix4()
  private m3 = new THREE.Matrix3()

  /** Rotação do celular no mundo (Y para cima), a partir do giroscópio; sem ele, olhando 35° para baixo. */
  private atualizarRotacao() {
    const q = this.q
    const rad = THREE.MathUtils.degToRad
    if (this.orientacao) {
      const { alpha, beta, gamma } = this.orientacao
      q.setFromEuler(this.euler.set(rad(beta), rad(alpha), -rad(gamma), 'YXZ'))
      q.multiply(this.q2.set(-Math.SQRT1_2, 0, 0, Math.SQRT1_2))
      q.multiply(this.q2.setFromAxisAngle(EIXO_Z, -rad(screen.orientation?.angle ?? 0)))
    } else q.setFromAxisAngle(EIXO_X, rad(-35))
    this.material.uniforms.uRot.value.setFromMatrix4(this.m4.makeRotationFromQuaternion(q))
  }

  private redimensionar() {
    const { clientWidth: l, clientHeight: a } = this.container
    if (!l || !a) return
    this.renderer.setSize(l, a, false)
    this.ajustarVideo()
  }

  /** A imagem cobre a tela (como `object-fit: cover`), e o campo de visão acompanha o recorte. */
  private ajustarVideo() {
    const { videoWidth: vl, videoHeight: va } = this.video
    const { clientWidth: l, clientHeight: a } = this.container
    if (!vl || !va || !l || !a) return
    const av = vl / va
    const at = l / a
    const u = this.material.uniforms
    u.uCobrir.value.set(av > at ? at / av : 1, av > at ? 1 : av / at)
    const t = Math.tan(CAMPO_DE_VISAO / 2)
    u.uTan.value.set(vl >= va ? t : (t * vl) / va, vl >= va ? (t * va) / vl : t)
  }

  // --- Área ligada ao toque --------------------------------------------------------------

  /**
   * O quadro atual da câmera, reduzido (lado maior = `lado`) pela placa de vídeo. Linhas de cima para
   * baixo. Pelo canvas 2D, parte dos Android devolve o vídeo preto.
   */
  private lerQuadro(lado: number): Quadro | null {
    const { videoWidth: vl, videoHeight: va } = this.video
    if (!vl || !va || this.video.readyState < 2) return null
    const k = lado / Math.max(vl, va)
    const l = Math.round(vl * k)
    const a = Math.round(va * k)
    let alvo = this.alvos.get(lado)
    if (!alvo || alvo.width !== l || alvo.height !== a) {
      alvo?.dispose()
      alvo = new THREE.WebGLRenderTarget(l, a, { depthBuffer: false })
      this.alvos.set(lado, alvo)
    }
    // Cada pixel pequeno é a média do pedaço de vídeo que ele cobre.
    this.reduzido.uniforms.uPasso.value.set(1 / l, 1 / a)
    const antes = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(alvo)
    this.renderer.render(this.cenaReduzida, this.camera)
    this.renderer.setRenderTarget(antes)
    const pixels = new Uint8Array(l * a * 4)
    this.renderer.readRenderTargetPixels(alvo, 0, 0, l, a, pixels)
    return { pixels, l, a }
  }

  /** Na imagem pequena, para cada superfície aprendida: a área com a cor dela ligada aos pontos tocados. */
  private atualizarArea(agora: number) {
    const quadro = this.lerQuadro(PEQUENA)
    if (!quadro) return
    const { pixels, l, a } = quadro
    const n = l * a
    if (this.dadosArea.length !== n * 4) {
      this.dadosArea = new Uint8Array(n * 4)
      this.areaAnterior = new Uint8Array(n * 4)
      this.area.dispose()
      this.area = new THREE.DataTexture(this.dadosArea, l, a, THREE.RGBAFormat)
      this.area.magFilter = this.area.minFilter = THREE.LinearFilter
      this.material.uniforms.uArea.value = this.area
      this.material.uniforms.uPassoArea.value.set(1 / l, 1 / a)
    }
    // O vídeo reduzido (mesma grade da máscara) guia a borda no shader.
    this.material.uniforms.uReduzido.value = this.alvos.get(PEQUENA)?.texture ?? null
    const d = this.dadosArea
    this.areaAnterior.set(d)
    d.fill(0)
    if (this.amostras.piso) this.preencher(pixels, l, a, this.amostras.piso, 0)
    if (this.amostras.parede) this.preencher(pixels, l, a, this.amostras.parede, 1)
    // Média com a área anterior: a borda deixa de piscar com o ruído da câmera. Parado, pesa mais.
    const ant = this.areaAnterior
    const k = this.paradoDesde && agora - this.paradoDesde > 150 ? 0.5 : 0.7
    for (let i = 0; i < d.length; i++) d[i] = Math.round(d[i] * k + ant[i] * (1 - k))
    this.area.needsUpdate = true
  }

  /**
   * Marca no canal `canal` (0 piso, 1 parede) a área da superfície ligada aos toques.
   * - Com a rede: a área é a que ela reconhece como a classe dos toques (parede, piso). A cor só tira o
   *   que é claramente outra coisa que ela deixou passar (um cabo azul, uma placa verde, o preto de um
   *   pé de móvel). Sombra, reflexo, rejunte e veio da madeira continuam dentro: nada de manchas.
   * - Sem a rede: só a cor, com o contorno segurando o preenchimento.
   * A borda fina não sai daqui: o shader "gruda" esta máscara nos contornos da imagem.
   */
  private preencher(pixels: Uint8Array, l: number, a: number, amostra: Amostra, canal: number) {
    const n = l * a
    const cores = amostra.pontos.flatMap((p) => p.cores)
    if (!cores.length) return
    // Comparações ao quadrado, na escala da cromaticidade (a tolerância da tela é 12× a distância).
    const tol = (amostra.tolerancia * 1.5) / 12
    const tol2 = tol * tol
    // Parede: dentro da área da rede, só sai o que é muito diferente (como era quando a parede saía
    // inteira). O piso segue mais rígido.
    const piso = canal === 0
    const outraCor = piso ? OUTRA_COR : OUTRA_COR_PAREDE
    const outraCor2 = tol2 * outraCor * outraCor
    const foraMin = piso ? BRILHO_FORA_MIN : BRILHO_FORA_PAREDE[0]
    const foraMax = piso ? BRILHO_FORA_MAX : BRILHO_FORA_PAREDE[1]
    const refs = new Float32Array(cores.length * 3)
    cores.forEach((c, i) => refs.set([c.croma.x, c.croma.y, c.croma.z], i * 3))
    const [luzMin, luzMax] = faixaLuz(amostra.pontos)

    // A área da rede, levada (pelo giroscópio) da grade dela para a imagem de agora: 0 fora, 1 na beirada
    // (a cor decide), 2 dentro.
    const mapa = amostra.mapa
    const u0 = this.material.uniforms
    const tan = u0.uTan.value as THREE.Vector2
    const m = mapa ? this.m3.copy(mapa.rot).transpose().multiply(u0.uRot.value).elements : null
    const paredeInteira = !piso && !!m
    // Sem a rede, tudo é "beirada": a cor decide em todo lugar.
    const rede = new Uint8Array(n).fill(1)

    // 0: não é a superfície; 1: é; 2: já na área ligada a um toque.
    const ok = new Uint8Array(n)
    const luzPx = new Float32Array(n)
    const crPx = new Float32Array(n)
    const cgPx = new Float32Array(n)
    const logLuz = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const p = i * 4
      const r = LINEAR[pixels[p]]
      const gg = LINEAR[pixels[p + 1]]
      const b = LINEAR[pixels[p + 2]]
      const soma = Math.max(r + gg + b, 1e-4)
      luzPx[i] = 0.2126 * r + 0.7152 * gg + 0.0722 * b
      logLuz[i] = Math.log(luzPx[i] + 0.01)
      crPx[i] = r / soma
      cgPx[i] = gg / soma
    }
    // Contorno (Sobel, por pixel): de brilho e de cor.
    const contorno = new Uint8Array(n)
    const limLuz = canal === 0 ? CONTORNO_LUZ.piso : CONTORNO_LUZ.parede
    const limCor = canal === 0 ? CONTORNO_COR.piso : CONTORNO_COR.parede
    const sobel = (v: Float32Array, i: number) => {
      const gx = v[i - l + 1] + 2 * v[i + 1] + v[i + l + 1] - v[i - l - 1] - 2 * v[i - 1] - v[i + l - 1]
      const gy = v[i + l - 1] + 2 * v[i + l] + v[i + l + 1] - v[i - l - 1] - 2 * v[i - l] - v[i - l + 1]
      return Math.hypot(gx, gy) / 8
    }
    for (let y = 1; y < a - 1; y++)
      for (let x = 1; x < l - 1; x++) {
        const i = y * l + x
        if (sobel(logLuz, i) > limLuz || sobel(crPx, i) + sobel(cgPx, i) > limCor) contorno[i] = 1
      }

    for (let i = 0; i < n; i++) {
      if (m && mapa) {
        const x = i % l
        const y = (i - x) / l
        const cx = ((x + 0.5) / l - 0.5) * 2 * tan.x
        const cy = (0.5 - (y + 0.5) / a) * 2 * tan.y
        // Matrix3 guarda por colunas: elements[col * 3 + linha].
        const ox = m[0] * cx + m[3] * cy - m[6]
        const oy = m[1] * cx + m[4] * cy - m[7]
        const oz = m[2] * cx + m[5] * cy - m[8]
        // Fora da grade da rede (o celular virou depois da leitura): a cor decide.
        let prob = -1
        if (oz < -0.01) {
          const gc = (((ox / -oz / tan.x) * 0.5 + 0.5) * mapa.l - 0.5) / PASSO_IA
          const gr = ((0.5 - (oy / -oz / tan.y) * 0.5) * mapa.a - 0.5) / PASSO_IA
          prob = lerGrade(mapa.prob, mapa.linhas, mapa.colunas, gc, gr)
        }
        rede[i] = prob < 0 ? 1 : prob >= PROB_DENTRO ? 2 : prob >= PROB_BEIRADA ? 1 : 0
        if (!rede[i]) continue
      }
      const lum = luzPx[i]
      const kr = crPx[i]
      const kg = cgPx[i]
      const kb = 1 - kr - kg
      let d2 = Infinity
      for (let c = 0; c < refs.length; c += 3) {
        const dr = kr - refs[c]
        const dg = kg - refs[c + 1]
        const db = kb - refs[c + 2]
        const e = dr * dr + dg * dg + db * db
        if (e < d2) d2 = e
      }
      // No escuro a cor fica imprecisa: aceita um pouco mais.
      if (lum < 0.08) d2 /= 1.69
      const rel = lum / luzMin
      if (rede[i] === 2) {
        // Dentro da área da rede: só sai o que é claramente outra coisa.
        ok[i] = d2 < outraCor2 && rel > foraMin && lum / luzMax < foraMax ? 1 : 0
      } else {
        ok[i] = d2 < tol2 && rel > BRILHO_MIN * 0.6 && lum / luzMax < BRILHO_MAX * 1.4 ? 1 : 0
      }
    }

    // Preenchimento (4 vizinhos) a partir de cada toque visível agora (pelo giroscópio).
    const pilha = new Int32Array(n)
    let topo = 0
    const giro = this.m3.copy(u0.uRot.value).transpose()
    for (const ponto of amostra.pontos) {
      const cam = ponto.semente.clone().applyMatrix3(giro)
      if (cam.z >= -0.01) continue
      const vx = (cam.x / -cam.z / tan.x) * 0.5 + 0.5
      const vy = (cam.y / -cam.z / tan.y) * 0.5 + 0.5
      if (vx < 0 || vx > 1 || vy < 0 || vy > 1) continue
      const s = this.pertoQueCombina(ok, l, a, Math.round(vx * (l - 1)), Math.round((1 - vy) * (a - 1)))
      if (s >= 0 && ok[s] === 1) {
        ok[s] = 2
        pilha[topo++] = s
      }
    }
    // Nenhum toque à vista (a pessoa virou o celular): a área segue a do quadro anterior, que ainda se
    // sobrepõe quase toda à de agora.
    if (!topo)
      for (let i = 0; i < n; i++)
        if (ok[i] === 1 && !contorno[i] && this.areaAnterior[i * 4 + canal] >= 160) {
          ok[i] = 2
          pilha[topo++] = i
        }
    // Parede, com a rede: vale toda a área que ela reconhece como parede (o corredor inteiro, mesmo com a
    // luz mudando ao longo dele), não só o pedaço até o primeiro contorno.
    if (paredeInteira)
      for (let i = 0; i < n; i++)
        if (ok[i] === 1 && rede[i] === 2) {
          ok[i] = 2
          pilha[topo++] = i
        }
    if (!topo) return
    // A partir dos toques (e, na parede, da área da rede), o preenchimento não atravessa contornos.
    const entrar = (j: number) => {
      if (ok[j] !== 1 || (contorno[j] && !(paredeInteira && rede[j] === 2))) return
      ok[j] = 2
      pilha[topo++] = j
    }
    while (topo) {
      const i = pilha[--topo]
      const x = i % l
      if (x > 0) entrar(i - 1)
      if (x < l - 1) entrar(i + 1)
      if (i >= l) entrar(i - l)
      if (i < n - l) entrar(i + l)
    }
    // O próprio contorno (1 pixel) entra onde encosta na área e tem a cor certa: sem vão até a borda.
    const encostar: number[] = []
    for (let i = 0; i < n; i++) {
      if (ok[i] !== 1 || !contorno[i]) continue
      const x = i % l
      if ((x > 0 && ok[i - 1] === 2) || (x < l - 1 && ok[i + 1] === 2) || (i >= l && ok[i - l] === 2) || (i < n - l && ok[i + l] === 2))
        encostar.push(i)
    }
    for (const i of encostar) ok[i] = 2

    // Buracos fechados por dentro da área: os pequenos (tomada, reflexo, ruído) sempre; com a rede, também
    // os maiores que ela diz serem a superfície (um reflexo forte de janela). O que encosta na borda da
    // imagem (um móvel saindo do quadro) fica.
    const visto = new Uint8Array(n)
    const comp: number[] = []
    const visitar = (j: number) => {
      if (ok[j] === 2 || visto[j]) return
      visto[j] = 1
      pilha[topo++] = j
    }
    for (let i0 = 0; i0 < n; i0++) {
      if (ok[i0] === 2 || visto[i0]) continue
      comp.length = 0
      let borda = false
      let daClasse = 0
      visto[i0] = 1
      pilha[0] = i0
      topo = 1
      while (topo) {
        const i = pilha[--topo]
        comp.push(i)
        const x = i % l
        if (x === 0 || x === l - 1 || i < l || i >= n - l) borda = true
        if (rede[i] === 2) daClasse++
        if (x > 0) visitar(i - 1)
        if (x < l - 1) visitar(i + 1)
        if (i >= l) visitar(i - l)
        if (i < n - l) visitar(i + l)
      }
      const total = comp.length
      const fecha = total <= n * BURACO || (!!m && daClasse >= total * 0.8 && total <= n * BURACO_REDE)
      if (!borda && fecha) for (const i of comp) ok[i] = 2
    }

    // Pontinhos soltos na borda (ruído): o pixel da área com 3 ou mais vizinhos fora sai.
    const dados = this.dadosArea
    for (let i = 0; i < n; i++) {
      if (ok[i] !== 2) continue
      const x = i % l
      const fora =
        +(x > 0 && ok[i - 1] !== 2) +
        +(x < l - 1 && ok[i + 1] !== 2) +
        +(i >= l && ok[i - l] !== 2) +
        +(i < n - l && ok[i + l] !== 2)
      if (fora < 3) dados[i * 4 + canal] = 255
    }
  }

  /** O pixel com a cor certa mais perto do ponto tocado (a mão treme, um objeto pode passar na frente). */
  private pertoQueCombina(ok: Uint8Array, l: number, a: number, sx: number, sy: number) {
    for (let r = 0; r <= 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const x = sx + dx
          const y = sy + dy
          if (x >= 0 && x < l && y >= 0 && y < a && ok[y * l + x]) return y * l + x
        }
    return -1
  }

  private parar() {
    this.fluxo?.getTracks().forEach((t) => t.stop())
    this.fluxo = null
    this.video.srcObject = null
  }

  private emitir(mudanca: Partial<EstadoCamera>) {
    const novo = { ...this.estado, ...mudanca }
    if (JSON.stringify(novo) === JSON.stringify(this.estado)) return
    this.estado = novo
    this.cb.aoEstado(novo)
  }
}
