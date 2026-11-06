import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buscarPeca, coresPadrao, type Medidas, type Peca } from '../data/pecas'
import type { OpcaoCor } from './ambiente'
import { asperezaTextura, projetarUV, textura } from './texturas'

/**
 * Peças de ambientação montadas com formas simples. Unidades em metros, chão em y = 0,
 * centro em x/z = 0 e frente para +Z (como os .glb do catálogo).
 */

type Mat = THREE.Material
type Construtor = (g: THREE.Group, m: Medidas, mat: (parte: string) => Mat, r: () => number) => void

const sorteio = (semente: number) => () => {
  semente = (semente * 16807) % 2147483647
  return (semente - 1) / 2147483646
}

// --- Materiais fixos ---------------------------------------------------------------

/** Materiais lisos reaproveitados entre peças (livros, roupas, sapatos repetem as mesmas cores). */
const padroes = new Map<string, THREE.MeshStandardMaterial>()
const padrao = (cor: string, aspereza = 0.6, metal = 0) => {
  const chave = `${cor}${aspereza}${metal}`
  let m = padroes.get(chave)
  if (!m) padroes.set(chave, (m = new THREE.MeshStandardMaterial({ color: cor, roughness: aspereza, metalness: metal })))
  return m
}

const fixos = {
  vidro: new THREE.MeshPhysicalMaterial({
    color: '#d8eaec',
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
  // Sem reflexo de verdade (custaria uma câmera a mais): prata clara que pega o brilho do ambiente.
  espelho: new THREE.MeshPhysicalMaterial({ color: '#d9e2e6', roughness: 0.08, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.02 }),
  preto: padrao('#161616', 0.45),
  vidroPreto: padrao('#0d0f12', 0.12, 0.3),
  inox: padrao('#c4c8cc', 0.3, 0.85),
  cromado: padrao('#dfe3e6', 0.08, 1),
  branco: padrao('#f4f3ef', 0.3),
  colchao: padrao('#f1eee8', 0.9),
  luz: new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd58a', emissiveIntensity: 1.6 }),
  brasa: new THREE.MeshStandardMaterial({ color: '#2a1a12', emissive: '#a8381a', emissiveIntensity: 0.5, roughness: 1 }),
  terra: padrao('#3b2b20', 1),
  tronco: padrao('#5b4331', 0.95),
}

/**
 * Material físico de cada acabamento: tecido com brilho aveludado, laca e pedra polida com verniz,
 * madeira, tijolo e pedra com relevo tirado do próprio desenho, metal refletindo o ambiente.
 */
const acabamentoDe = (op: OpcaoCor, forcarTextura?: OpcaoCor['textura']) => {
  const tipo = forcarTextura ?? op.textura
  const mapa = tipo ? textura(tipo, op.hex) : null
  const m = new THREE.MeshPhysicalMaterial({
    color: tipo ? '#ffffff' : op.hex,
    map: mapa,
    // Metal escovado: reflete o ambiente sem virar espelho (espelho puro sai escuro de alguns ângulos).
    roughness: op.metal ? 0.34 : ((tipo && asperezaTextura[tipo]) ?? 0.5),
    metalness: op.metal ? 0.8 : 0,
  })
  if (tipo === 'tecido') {
    m.sheen = 1
    m.sheenRoughness = 0.75
    m.sheenColor = new THREE.Color(op.hex).lerp(new THREE.Color('#ffffff'), 0.45)
    m.roughness = 0.95
  } else if (tipo === 'granito' || tipo === 'marmore') {
    m.clearcoat = 0.8
    m.clearcoatRoughness = 0.12
  } else if (tipo === 'madeira' || tipo === 'ripado' || tipo === 'tijolo' || tipo === 'pedra') {
    m.bumpMap = mapa
    m.bumpScale = tipo === 'madeira' ? 0.6 : 2
    m.clearcoat = tipo === 'madeira' ? 0.25 : 0
    m.clearcoatRoughness = 0.5
    m.roughness = tipo === 'madeira' ? 0.55 : 0.9
  } else if (!tipo && !op.metal) {
    // Marcenaria lisa: laca acetinada.
    m.clearcoat = 0.35
    m.clearcoatRoughness = 0.35
    m.roughness = 0.42
  }
  return m
}

/** Tom mais claro (t > 0) ou mais escuro (t < 0) de um material. */
const variante = (m: Mat, t: number) => {
  const c = (m as THREE.MeshStandardMaterial).clone()
  if (t > 0) c.color.lerp(new THREE.Color('#ffffff'), t)
  else c.color.multiplyScalar(1 + t)
  return c
}

// --- Formas ------------------------------------------------------------------

const malha = (g: THREE.Object3D, geo: THREE.BufferGeometry, mat: Mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(projetarUV(geo), mat)
  m.position.set(x, y, z)
  m.castShadow = !(mat as THREE.MeshPhysicalMaterial).transparent
  m.receiveShadow = true
  g.add(m)
  return m
}

/** Caixa com a base em `y`, levemente arredondada. */
const caixa = (g: THREE.Object3D, l: number, a: number, p: number, mat: Mat, x = 0, y = 0, z = 0, raio = 0.004) => {
  const r = Math.min(raio, Math.min(l, a, p) / 2 - 0.0005)
  const geo = r > 0.0008 ? new RoundedBoxGeometry(l, a, p, 2, r) : new THREE.BoxGeometry(l, a, p)
  return malha(g, geo, mat, x, y + a / 2, z)
}

const cilindro = (g: THREE.Object3D, rTopo: number, rBase: number, a: number, mat: Mat, x = 0, y = 0, z = 0, lados = 28) =>
  malha(g, new THREE.CylinderGeometry(rTopo, rBase, a, lados), mat, x, y + a / 2, z)

const esfera = (g: THREE.Object3D, raio: number, mat: Mat, x = 0, y = 0, z = 0) =>
  malha(g, new THREE.IcosahedronGeometry(raio, 1), mat, x, y, z)

/** Frentes de porta lado a lado em `[x0, x1]`, com puxador. */
function frentes(
  g: THREE.Group,
  x0: number,
  x1: number,
  y0: number,
  a: number,
  z: number,
  mat: Mat,
  n = Math.max(1, Math.round((x1 - x0) / 0.45)),
  puxador: 'cima' | 'baixo' | 'lado' | 'cava' = 'cima',
) {
  const folga = 0.003
  const l = (x1 - x0) / n
  for (let i = 0; i < n; i++) {
    const cx = x0 + l * (i + 0.5)
    caixa(g, l - folga, a - folga, 0.018, mat, cx, y0 + folga / 2, z + 0.009, 0.002)
    if (puxador === 'cava') continue
    const lado = i % 2 ? -1 : 1
    if (puxador === 'lado') caixa(g, 0.012, Math.min(0.3, a * 0.4), 0.02, fixos.inox, cx - lado * (l / 2 - 0.04), y0 + a / 2 - 0.1, z + 0.025, 0.004)
    else caixa(g, Math.min(0.14, l * 0.5), 0.012, 0.02, fixos.inox, cx, puxador === 'cima' ? y0 + a - 0.05 : y0 + 0.04, z + 0.025, 0.004)
  }
}

/** Gavetas empilhadas em `[y0, y0 + a]`. */
function gavetas(g: THREE.Group, l: number, y0: number, a: number, z: number, mat: Mat, n: number, x = 0) {
  const h = a / n
  for (let i = 0; i < n; i++) {
    caixa(g, l - 0.004, h - 0.004, 0.018, mat, x, y0 + h * i + 0.002, z + 0.009, 0.002)
    caixa(g, Math.min(0.16, l * 0.4), 0.012, 0.02, fixos.inox, x, y0 + h * i + h - 0.05, z + 0.025, 0.004)
  }
}

/** Balcão: rodapé recuado, corpo e tampo. Devolve a altura do tampo. */
function balcao(g: THREE.Group, l: number, p: number, a: number, mat: (p: string) => Mat) {
  const rodape = 0.1
  const tampo = 0.03
  caixa(g, l - 0.04, rodape, p - 0.1, fixos.preto, 0, 0, -0.04, 0)
  caixa(g, l, a - rodape - tampo, p - 0.04, mat('corpo'), 0, rodape, -0.02, 0.002)
  caixa(g, l + 0.004, tampo, p, mat('tampo'), 0, a - tampo, 0, 0.003)
  return { rodape, frente: p / 2 - 0.04, altura: a - rodape - tampo }
}

function torneira(g: THREE.Group, x: number, y: number, z: number, alta = 0.28) {
  cilindro(g, 0.014, 0.018, alta, fixos.cromado, x, y, z)
  const bico = malha(g, new THREE.CylinderGeometry(0.011, 0.011, 0.18, 16), fixos.cromado, x, y + alta - 0.01, z + 0.09)
  bico.rotation.x = Math.PI / 2
}

function cuba(g: THREE.Group, x: number, y: number, z: number, l: number, p: number) {
  caixa(g, l + 0.02, 0.004, p + 0.02, fixos.inox, x, y, z, 0.001)
  caixa(g, l, 0.002, p, padrao('#8e9296', 0.35, 0.8), x, y + 0.004, z, 0.001)
}

// --- Peças -------------------------------------------------------------------

const construtores: Record<string, Construtor> = {
  bancada(g, { l, p, a }, mat) {
    const b = balcao(g, l, p, a, mat)
    frentes(g, -l / 2, l / 2, b.rodape, b.altura, b.frente, mat('corpo'))
  },

  'bancada-pia'(g, { l, p, a }, mat) {
    const b = balcao(g, l, p, a, mat)
    frentes(g, -l / 2, l / 2, b.rodape, b.altura, b.frente, mat('corpo'))
    const x = l > 1.2 ? -l / 4 + 0.1 : 0
    cuba(g, x, a, 0.02, Math.min(0.6, l - 0.2), 0.4)
    torneira(g, x, a, -p / 2 + 0.07)
  },

  'bancada-cooktop'(g, { l, p, a }, mat) {
    const b = balcao(g, l, p, a, mat)
    const forno = 0.6
    caixa(g, forno, 0.56, 0.02, fixos.vidroPreto, 0, b.rodape + b.altura - 0.62, b.frente + 0.01, 0.004)
    caixa(g, 0.5, 0.015, 0.03, fixos.inox, 0, b.rodape + b.altura - 0.1, b.frente + 0.035, 0.005)
    caixa(g, forno, 0.09, 0.02, mat('corpo'), 0, b.rodape + b.altura - 0.09, b.frente + 0.01, 0.002)
    if (l > forno + 0.1) {
      frentes(g, -l / 2, -forno / 2, b.rodape, b.altura, b.frente, mat('corpo'), 1)
      frentes(g, forno / 2, l / 2, b.rodape, b.altura, b.frente, mat('corpo'), 1)
    }
    caixa(g, 0.6, 0.006, 0.5, fixos.vidroPreto, 0, a, 0, 0.002)
    const queimadores = [
      [-0.15, -0.12, 0.08],
      [0.15, -0.12, 0.06],
      [-0.15, 0.12, 0.06],
      [0.15, 0.12, 0.08],
    ]
    for (const [x, z, r] of queimadores) {
      const anel = malha(g, new THREE.TorusGeometry(r, 0.004, 6, 32), padrao('#6b6e72', 0.4, 0.6), x, a + 0.007, z)
      anel.rotation.x = Math.PI / 2
    }
  },

  'armario-aereo'(g, { l, p, a }, mat) {
    caixa(g, l, a, p - 0.02, mat('corpo'), 0, 0, -0.01, 0.002)
    frentes(g, -l / 2, l / 2, 0, a, p / 2 - 0.02, mat('corpo'), undefined, 'baixo')
  },

  'armario-alto'(g, { l, p, a }, mat) {
    caixa(g, l, a, p - 0.02, mat('corpo'), 0, 0, -0.01, 0.002)
    const n = Math.max(1, Math.round(l / 0.5))
    frentes(g, -l / 2, l / 2, 0.08, 0.85, p / 2 - 0.02, mat('corpo'), n, 'cima')
    frentes(g, -l / 2, l / 2, 0.93, a - 0.93, p / 2 - 0.02, mat('corpo'), n, 'baixo')
  },

  geladeira(g, { l, p, a }, mat) {
    const m = mat('metal')
    caixa(g, l, a, p - 0.04, m, 0, 0, -0.02, 0.02)
    const frente = p / 2 - 0.04
    const freezer = a * 0.3
    caixa(g, l - 0.006, a - freezer - 0.01, 0.04, m, 0, 0.01, frente + 0.02, 0.012)
    caixa(g, l - 0.006, freezer - 0.012, 0.04, m, 0, a - freezer + 0.004, frente + 0.02, 0.012)
    caixa(g, 0.02, 0.42, 0.03, fixos.preto, l / 2 - 0.06, a - freezer - 0.5, frente + 0.055, 0.008)
    caixa(g, 0.02, freezer * 0.6, 0.03, fixos.preto, l / 2 - 0.06, a - freezer * 0.8, frente + 0.055, 0.008)
  },

  coifa(g, { l, p, a }, mat) {
    const m = mat('metal')
    caixa(g, l, 0.06, p, m, 0, 0, 0, 0.004)
    caixa(g, l * 0.62, 0.18, p * 0.65, m, 0, 0.06, -p * 0.17, 0.01)
    caixa(g, 0.28, a - 0.24, 0.25, m, 0, 0.24, -p / 2 + 0.125, 0.004)
    caixa(g, l - 0.06, 0.004, p - 0.06, fixos.luz, 0, -0.002, 0, 0)
  },

  ilha(g, { l, p, a }, mat) {
    const balanco = Math.min(0.3, p * 0.3)
    caixa(g, l - 0.06, 0.1, p - balanco - 0.08, fixos.preto, 0, 0, -balanco / 2, 0)
    caixa(g, l, a - 0.14, p - balanco, mat('corpo'), 0, 0.1, -balanco / 2, 0.002)
    frentes(g, -l / 2, l / 2, 0.1, a - 0.14, -(p / 2) - 0.018 + 0.0001, mat('corpo'), undefined, 'cava')
    caixa(g, l, 0.04, p, mat('tampo'), 0, a - 0.04, 0, 0.004)
  },

  banqueta(g, { l, a }, mat) {
    const r = l / 2
    malha(g, new THREE.CylinderGeometry(r, r * 0.95, 0.05, 32), mat('assento'), 0, a - 0.025, 0)
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + (i * Math.PI) / 2
      const perna = cilindro(g, 0.012, 0.012, a - 0.05, mat('metal'), Math.cos(ang) * r * 0.62, 0, Math.sin(ang) * r * 0.62, 10)
      perna.rotation.z = Math.cos(ang) * -0.06
      perna.rotation.x = Math.sin(ang) * 0.06
    }
    const aro = malha(g, new THREE.TorusGeometry(r * 0.66, 0.008, 6, 32), mat('metal'), 0, 0.28, 0)
    aro.rotation.x = Math.PI / 2
  },

  'vaso-sanitario'(g, { l, p }, mat) {
    const m = mat('louca')
    const base = malha(g, new THREE.CylinderGeometry(0.17, 0.12, 0.38, 32), m, 0, 0.19, 0.06)
    base.scale.z = 1.35
    const assento = malha(g, new THREE.CylinderGeometry(0.19, 0.18, 0.035, 32), m, 0, 0.4, 0.07)
    assento.scale.set(l / 0.4, 1, 1.4)
    caixa(g, l - 0.02, 0.38, 0.17, m, 0, 0.38, -p / 2 + 0.085, 0.03)
    cilindro(g, 0.02, 0.02, 0.01, fixos.cromado, 0, 0.76, -p / 2 + 0.085)
  },

  gabinete(g, { l, p, a }, mat) {
    const y0 = 0.32
    caixa(g, l, a - y0 - 0.02, p - 0.02, mat('corpo'), 0, y0, -0.01, 0.002)
    gavetas(g, l, y0, a - y0 - 0.02, p / 2 - 0.02, mat('corpo'), 1)
    caixa(g, l, 0.02, p, mat('tampo'), 0, a - 0.02, 0, 0.002)
    const loucaDupla = (mat('louca') as THREE.MeshStandardMaterial).clone()
    loucaDupla.side = THREE.DoubleSide
    const bacia = malha(g, new THREE.SphereGeometry(0.19, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), loucaDupla, 0, a + 0.13, 0.03)
    bacia.scale.y = 0.7
    malha(g, new THREE.TorusGeometry(0.19, 0.008, 8, 40), mat('louca'), 0, a + 0.13, 0.03).rotation.x = Math.PI / 2
    torneira(g, 0, a, -p / 2 + 0.06, 0.32)
  },

  espelho(g, { l, a, p }, mat) {
    caixa(g, l, a, p, mat('moldura'), 0, 0, 0, 0.003)
    caixa(g, l - 0.03, a - 0.03, 0.004, fixos.espelho, 0, 0.015, p / 2, 0)
  },

  'espelho-redondo'(g, { l, p }, mat) {
    const r = l / 2
    malha(g, new THREE.CylinderGeometry(r, r, p, 64), mat('moldura'), 0, r, 0).rotation.x = Math.PI / 2
    malha(g, new THREE.CylinderGeometry(r - 0.015, r - 0.015, 0.004, 64), fixos.espelho, 0, r, p / 2).rotation.x = Math.PI / 2
  },

  box(g, { l, p, a }, mat) {
    const m = mat('metal')
    caixa(g, l, 0.04, p, fixos.branco, 0, 0, 0, 0.006)
    caixa(g, 0.12, 0.004, 0.02, padrao('#8a8d90', 0.4, 0.7), 0, 0.04, 0.1, 0)
    const h = a - 0.06
    // Vidro na frente e do lado esquerdo; atrás e à direita ficam as paredes.
    caixa(g, l - 0.02, h, 0.008, fixos.vidro, 0, 0.05, p / 2 - 0.01, 0)
    caixa(g, 0.008, h, p - 0.02, fixos.vidro, -l / 2 + 0.01, 0.05, 0, 0)
    caixa(g, l, 0.02, 0.02, m, 0, a - 0.02, p / 2 - 0.01, 0)
    caixa(g, 0.02, 0.02, p, m, -l / 2 + 0.01, a - 0.02, 0, 0)
    caixa(g, 0.02, h, 0.02, m, -l / 2 + 0.01, 0.04, p / 2 - 0.01, 0)
    caixa(g, 0.015, 0.25, 0.025, m, l * 0.1, 0.95, p / 2 + 0.008, 0.005)
    // Chuveiro de teto saindo da parede do fundo.
    caixa(g, 0.02, 0.02, 0.32, m, l / 4, a - 0.12, -p / 2 + 0.16, 0.008)
    malha(g, new THREE.CylinderGeometry(0.11, 0.11, 0.012, 32), m, l / 4, a - 0.13, -p / 2 + 0.32)
    cilindro(g, 0.035, 0.035, 0.02, m, l / 4, 1.05, -p / 2 + 0.01).rotation.x = Math.PI / 2
  },

  banheira(g, { l, p, a }, mat) {
    const m = mat('louca')
    caixa(g, l, a, p, m, 0, 0, 0, 0.05)
    caixa(g, l - 0.14, 0.006, p - 0.14, variante(m, -0.08), 0, a - 0.003, 0, 0.04)
    caixa(g, l - 0.18, 0.004, p - 0.18, padrao('#bfdde2', 0.05), 0, a - 0.002, 0, 0.04)
    torneira(g, -l / 2 + 0.05, a, 0, 0.16)
  },

  'maquina-lavar'(g, { l, p, a }, mat) {
    const m = mat('metal')
    caixa(g, l, a, p, m, 0, 0, 0, 0.015)
    caixa(g, l - 0.04, 0.09, 0.006, variante(m, -0.15), 0, a - 0.11, p / 2, 0.003)
    cilindro(g, 0.025, 0.025, 0.02, fixos.cromado, l / 2 - 0.08, a - 0.065, p / 2 + 0.002).rotation.x = Math.PI / 2
    malha(g, new THREE.TorusGeometry(0.17, 0.028, 12, 48), fixos.cromado, 0, a * 0.42, p / 2 + 0.01)
    malha(g, new THREE.CylinderGeometry(0.15, 0.15, 0.01, 48), fixos.vidroPreto, 0, a * 0.42, p / 2 + 0.008).rotation.x = Math.PI / 2
  },

  secadora(g, m, mat, r) {
    construtores['maquina-lavar'](g, m, mat, r)
  },

  tanque(g, { l, p, a }, mat) {
    const m = mat('louca')
    caixa(g, l, 0.3, p, m, 0, a - 0.3, 0, 0.02)
    caixa(g, l - 0.08, 0.004, p - 0.12, variante(m, -0.12), 0, a - 0.002, 0.02, 0.02)
    caixa(g, 0.18, a - 0.3, 0.14, m, 0, 0, -p / 2 + 0.12, 0.02)
    torneira(g, 0, a, -p / 2 + 0.04, 0.22)
  },

  cesto(g, { l, a }, mat) {
    const m = mat('cesto')
    cilindro(g, l / 2, l / 2.4, a, m)
    esfera(g, l / 2.3, fixos.colchao, 0, a - 0.02, 0).scale.y = 0.35
  },

  churrasqueira(g, { l, p, a }, mat) {
    const alv = mat('alvenaria')
    const base = 0.9
    caixa(g, l, base, p, alv, 0, 0, 0, 0.004)
    // Vão da lenha, com algumas toras.
    caixa(g, l - 0.24, 0.42, 0.02, fixos.preto, 0, 0.12, p / 2 - 0.009, 0)
    for (let i = 0; i < 5; i++) {
      const tora = malha(g, new THREE.CylinderGeometry(0.045, 0.045, p - 0.2, 10), fixos.tronco, -0.22 + i * 0.11, 0.17 + (i % 2) * 0.08, 0)
      tora.rotation.x = Math.PI / 2
    }
    caixa(g, l + 0.04, 0.04, p + 0.04, mat('tampo'), 0, base, 0, 0.003)
    const y = base + 0.04
    const coluna = 0.18
    caixa(g, coluna, 0.6, p, alv, -l / 2 + coluna / 2, y, 0, 0.003)
    caixa(g, coluna, 0.6, p, alv, l / 2 - coluna / 2, y, 0, 0.003)
    caixa(g, l - coluna * 2, 0.6, 0.06, alv, 0, y, -p / 2 + 0.03, 0)
    caixa(g, l - coluna * 2, 0.12, p - 0.08, fixos.brasa, 0, y, 0.02, 0)
    for (let i = 0; i < 9; i++) {
      const espeto = malha(g, new THREE.CylinderGeometry(0.004, 0.004, l - coluna * 2, 6), fixos.inox, 0, y + 0.28, -p / 2 + 0.1 + i * ((p - 0.16) / 8))
      espeto.rotation.z = Math.PI / 2
    }
    const topo = y + 0.6
    caixa(g, l + 0.04, 0.3, p + 0.04, alv, 0, topo, 0, 0.004)
    caixa(g, l * 0.7, 0.22, p * 0.75, alv, 0, topo + 0.3, -p * 0.1, 0.004)
    caixa(g, 0.36, Math.max(0.2, a - topo - 0.52), 0.36, alv, 0, topo + 0.52, -p / 2 + 0.22, 0.003)
  },

  piscina(g, { l, p }, mat) {
    const b = 0.3
    const borda = mat('borda')
    caixa(g, l, 0.05, b, borda, 0, 0, -p / 2 + b / 2, 0.006)
    caixa(g, l, 0.05, b, borda, 0, 0, p / 2 - b / 2, 0.006)
    caixa(g, b, 0.05, p - 2 * b, borda, -l / 2 + b / 2, 0, 0, 0.006)
    caixa(g, b, 0.05, p - 2 * b, borda, l / 2 - b / 2, 0, 0, 0.006)
    const agua = mat('agua').userData.hex as string
    const fundo = acabamentoDe({ nome: '', hex: agua }, 'pastilha')
    const pastilha = caixa(g, l - 2 * b, 0.004, p - 2 * b, fundo, 0, 0.004, 0, 0)
    pastilha.castShadow = false
    const espelho = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(agua).lerp(new THREE.Color('#ffffff'), 0.15),
      roughness: 0.04,
      clearcoat: 1,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    caixa(g, l - 2 * b, 0.004, p - 2 * b, espelho, 0, 0.028, 0, 0)
    // Escada de inox numa das bordas.
    for (const dx of [-0.25, 0.25]) {
      const tubo = malha(g, new THREE.TorusGeometry(0.16, 0.014, 8, 20, Math.PI), fixos.cromado, l / 2 - b - 0.6 + dx, 0.05, p / 2 - b - 0.02)
      tubo.rotation.y = Math.PI / 2
    }
  },

  espreguicadeira(g, { l, p }, mat) {
    const e = mat('estrutura')
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      caixa(g, 0.05, 0.2, 0.05, e, (x * (l - 0.08)) / 2, 0, (z * (p - 0.1)) / 2, 0.004)
    caixa(g, l, 0.06, p, e, 0, 0.2, 0, 0.006)
    const assento = p * 0.62
    caixa(g, l - 0.04, 0.07, assento, mat('tecido'), 0, 0.26, p / 2 - assento / 2, 0.03)
    const encosto = p - assento - 0.02
    const ang = 0.75
    const z0 = p / 2 - assento
    const peca = caixa(g, l - 0.04, 0.07, encosto, mat('tecido'), 0, 0, 0, 0.03)
    peca.rotation.x = ang
    peca.position.set(0, 0.3 + (encosto / 2) * Math.sin(ang), z0 - (encosto / 2) * Math.cos(ang))
  },

  'guarda-sol'(g, { l, a }, mat) {
    cilindro(g, 0.22, 0.25, 0.06, fixos.preto)
    cilindro(g, 0.02, 0.02, a - 0.05, mat('estrutura'), 0, 0.05, 0, 12)
    const lona = malha(g, new THREE.ConeGeometry(l / 2, 0.5, 8, 1, true), mat('tecido'), 0, a - 0.3, 0)
    ;(lona.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  },

  deck(g, { l, p, a }, mat) {
    const ripas = acabamentoDe({ nome: '', hex: mat('madeira').userData.hex as string }, 'ripado')
    caixa(g, l, a, p, ripas, 0, 0, 0, 0.003).castShadow = false
  },

  mesa(g, { l, p, a }, mat) {
    caixa(g, l, 0.04, p, mat('tampo'), 0, a - 0.04, 0, 0.006)
    const pe = mat('metal')
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      caixa(g, 0.05, a - 0.04, 0.05, pe, x * (l / 2 - 0.1), 0, z * (p / 2 - 0.1), 0.004)
    caixa(g, l - 0.25, 0.08, p - 0.25, pe, 0, a - 0.12, 0, 0.003)
  },

  cadeira(g, { l, p, a }, mat) {
    const e = mat('estrutura')
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      caixa(g, 0.03, 0.44, 0.03, e, x * (l / 2 - 0.03), 0, z * (p / 2 - 0.04), 0.003)
    caixa(g, l, 0.03, p - 0.04, e, 0, 0.42, 0, 0.004)
    caixa(g, l - 0.04, 0.05, p - 0.1, mat('tecido'), 0, 0.45, 0.02, 0.02)
    for (const x of [-1, 1]) caixa(g, 0.03, a - 0.45, 0.03, e, x * (l / 2 - 0.03), 0.45, -p / 2 + 0.04, 0.003)
    caixa(g, l, 0.2, 0.025, e, 0, a - 0.22, -p / 2 + 0.04, 0.006)
  },

  sofa(g, { l, p, a }, mat) {
    const t = mat('tecido')
    const braco = 0.18
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      cilindro(g, 0.018, 0.012, 0.1, mat('pes'), x * (l / 2 - 0.08), 0, z * (p / 2 - 0.08), 12)
    caixa(g, l, 0.2, p, t, 0, 0.1, 0, 0.03)
    caixa(g, braco, 0.52, p, t, -l / 2 + braco / 2, 0.1, 0, 0.05)
    caixa(g, braco, 0.52, p, t, l / 2 - braco / 2, 0.1, 0, 0.05)
    caixa(g, l - braco * 2, a - 0.3, 0.2, t, 0, 0.3, -p / 2 + 0.1, 0.05)
    const n = l > 1.9 ? 3 : 2
    const lc = (l - braco * 2) / n
    for (let i = 0; i < n; i++) {
      const x = -l / 2 + braco + lc * (i + 0.5)
      caixa(g, lc - 0.012, 0.14, p - 0.26, t, x, 0.3, 0.11, 0.06)
      const enc = caixa(g, lc - 0.02, 0.42, 0.16, variante(t, 0.04), x, 0.4, -p / 2 + 0.27, 0.07)
      enc.rotation.x = -0.12
    }
    // Almofadas soltas nos cantos, em linho e num tom mais escuro do tecido.
    const linho = acabamentoDe({ nome: '', hex: '#e9e2d4', textura: 'tecido' })
    const escura = variante(t, -0.35)
    for (const [lado, mat, giro] of [
      [-1, linho, 0.25],
      [1, escura, -0.2],
      [-0.62, escura, 0.12],
    ] as const) {
      const a2 = almofada(g, 0.42, mat, (lado * (l - braco * 2)) / 2 + -lado * 0.25, 0.47, -p / 2 + 0.4)
      a2.rotation.set(-0.25, giro, 0)
    }
  },

  'mesa-centro'(g, { l, p, a }, mat) {
    caixa(g, l, 0.035, p, mat('tampo'), 0, a - 0.035, 0, 0.01)
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      cilindro(g, 0.014, 0.014, a - 0.035, mat('metal'), x * (l / 2 - 0.07), 0, z * (p / 2 - 0.07), 12)
    caixa(g, l - 0.1, 0.02, p - 0.1, mat('tampo'), 0, 0.12, 0, 0.006)
  },

  rack(g, { l, p, a }, mat) {
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      cilindro(g, 0.015, 0.015, 0.1, fixos.preto, x * (l / 2 - 0.06), 0, z * (p / 2 - 0.06), 10)
    caixa(g, l, a - 0.1, p - 0.02, mat('corpo'), 0, 0.1, -0.01, 0.004)
    frentes(g, -l / 2 + 0.01, l / 2 - 0.01, 0.12, a - 0.14, p / 2 - 0.02, mat('corpo'), Math.max(2, Math.round(l / 0.45)), 'cava')
    for (let i = 1; i < Math.max(2, Math.round(l / 0.45)); i++)
      caixa(g, 0.004, a - 0.16, 0.004, fixos.preto, -l / 2 + (l / Math.max(2, Math.round(l / 0.45))) * i, 0.13, p / 2, 0)
  },

  tv(g, { l, p, a }, mat) {
    caixa(g, l, a, p * 0.5, mat('metal'), 0, 0, -p / 4, 0.004)
    caixa(g, l - 0.012, a - 0.012, 0.004, fixos.vidroPreto, 0, 0.006, 0.001, 0)
    caixa(g, l * 0.6, a * 0.55, p * 0.5, fixos.preto, 0, a * 0.2, -p / 2 + 0.01, 0)
  },

  estante(g, { l, p, a }, mat, r) {
    const m = mat('corpo')
    const e = 0.022
    caixa(g, e, a, p, m, -l / 2 + e / 2, 0, 0, 0)
    caixa(g, e, a, p, m, l / 2 - e / 2, 0, 0, 0)
    caixa(g, l, 0.008, p * 0.9, variante(m, -0.15), 0, 0, -p / 2 + p * 0.45, 0)
    caixa(g, l - 2 * e, 0.008, 0.008, m, 0, 0, 0, 0)
    const n = Math.max(2, Math.round(a / 0.36))
    const vao = (a - e) / n
    const cores = ['#b0603a', '#2d3a2e', '#d8c6a9', '#44566b', '#efece6', '#8a9a7b', '#2b2b2d', '#c9a043']
    for (let i = 0; i <= n; i++) {
      const y = i * vao
      caixa(g, l - 2 * e, e, p, m, 0, Math.min(y, a - e), 0, 0)
      if (i === n) break
      // Livros, caixas e vasos nas prateleiras.
      let x = -l / 2 + e + 0.03
      const fim = l / 2 - e - 0.03
      while (x < fim - 0.05) {
        const tipo = r()
        if (tipo < 0.6) {
          const qtd = 3 + Math.floor(r() * 7)
          for (let k = 0; k < qtd && x < fim - 0.03; k++) {
            const lw = 0.02 + r() * 0.025
            const h = Math.min(vao - 0.05, 0.18 + r() * 0.1)
            caixa(g, lw, h, p * 0.7, padrao(cores[Math.floor(r() * cores.length)], 0.8), x + lw / 2, y + e, 0, 0.002)
            x += lw + 0.002
          }
        } else if (tipo < 0.8) {
          const raio = 0.04 + r() * 0.03
          cilindro(g, raio * 0.8, raio, Math.min(vao - 0.06, 0.12 + r() * 0.12), padrao(cores[Math.floor(r() * cores.length)], 0.4), x + raio, y + e, 0, 20)
          x += raio * 2
        }
        x += 0.04 + r() * 0.12
      }
    }
  },

  tapete(g, { l, p }, mat) {
    const t = mat('tecido')
    caixa(g, l, 0.008, p, t, 0, 0, 0, 0).castShadow = false
    const faixa = variante(t, -0.25)
    const f = Math.min(0.08, l * 0.05)
    for (const [w, d, x, z] of [
      [l - 0.16, f, 0, -p / 2 + 0.12],
      [l - 0.16, f, 0, p / 2 - 0.12],
      [f, p - 0.24, -l / 2 + 0.12, 0],
      [f, p - 0.24, l / 2 - 0.12, 0],
    ])
      caixa(g, w, 0.002, d, faixa, x, 0.008, z, 0).castShadow = false
  },

  cortina(g, { l, a }, mat) {
    const geo = new THREE.PlaneGeometry(l, a - 0.05, Math.max(24, Math.round(l * 40)), 1)
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / 0.11) * Math.PI) * 0.03)
    geo.computeVertexNormals()
    const t = (mat('tecido') as THREE.MeshStandardMaterial).clone()
    t.side = THREE.DoubleSide
    malha(g, geo, t, 0, (a - 0.05) / 2, 0)
    malha(g, new THREE.CylinderGeometry(0.012, 0.012, l + 0.16, 12), fixos.preto, 0, a - 0.03, -0.02).rotation.z = Math.PI / 2
  },

  puff(g, { l, a }, mat) {
    cilindro(g, l / 2, l / 2, a - 0.03, mat('tecido'), 0, 0, 0, 36)
    esfera(g, l / 2, mat('tecido'), 0, a - 0.05, 0).scale.set(1, 0.12, 1)
  },

  'cama-casal'(g, { l, p, a }, mat) {
    const e = mat('estrutura')
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      caixa(g, 0.06, 0.1, 0.06, e, x * (l / 2 - 0.06), 0, z * (p / 2 - 0.08), 0.005)
    caixa(g, l, 0.25, p - 0.06, e, 0, 0.1, 0.03, 0.008)
    caixa(g, l + 0.08, a, 0.06, e, 0, 0, -p / 2 + 0.03, 0.01)
    caixa(g, l - 0.04, 0.24, p - 0.12, fixos.colchao, 0, 0.35, 0.04, 0.05)
    const roupa = mat('roupa')
    caixa(g, l + 0.02, 0.05, p * 0.66, roupa, 0, 0.56, p / 2 - p * 0.33 + 0.01, 0.025)
    caixa(g, l + 0.04, 0.3, 0.02, roupa, 0, 0.3, p / 2 + 0.005, 0.01)
    caixa(g, 0.02, 0.28, p * 0.64, roupa, -l / 2 - 0.004, 0.32, p / 2 - p * 0.33, 0.01)
    caixa(g, 0.02, 0.28, p * 0.64, roupa, l / 2 + 0.004, 0.32, p / 2 - p * 0.33, 0.01)
    caixa(g, l + 0.03, 0.06, 0.25, variante(roupa, 0.3), 0, 0.57, -p / 2 + p * 0.34 + 0.12, 0.025)
    for (const x of [-1, 1]) {
      const trav = caixa(g, l / 2 - 0.08, 0.13, 0.4, fixos.colchao, (x * l) / 4, 0.6, -p / 2 + 0.3, 0.05)
      trav.rotation.x = -0.35
      almofada(g, 0.42, variante(roupa, -0.15), (x * l) / 5, 0.72, -p / 2 + 0.52).rotation.set(-0.45, x * 0.08, 0)
    }
    almofada(g, 0.36, variante(roupa, 0.25), 0, 0.7, -p / 2 + 0.6).rotation.set(-0.4, 0, 0)
  },

  'criado-mudo'(g, { l, p, a }, mat) {
    caixa(g, l, a - 0.12, p - 0.02, mat('corpo'), 0, 0.12, -0.01, 0.004)
    gavetas(g, l - 0.02, 0.14, a - 0.16, p / 2 - 0.02, mat('corpo'), 2)
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      cilindro(g, 0.012, 0.01, 0.12, fixos.preto, x * (l / 2 - 0.04), 0, z * (p / 2 - 0.05), 10)
  },

  'guarda-roupa'(g, { l, p, a }, mat) {
    caixa(g, l, a, p - 0.02, mat('corpo'), 0, 0, -0.01, 0.003)
    frentes(g, -l / 2, l / 2, 0.02, a - 0.04, p / 2 - 0.02, mat('corpo'), Math.max(2, Math.round(l / 0.5)), 'lado')
  },

  closet(g, { l, p, a }, mat, r) {
    const m = mat('corpo')
    const e = 0.022
    caixa(g, e, a, p, m, -l / 2 + e / 2, 0, 0, 0)
    caixa(g, e, a, p, m, l / 2 - e / 2, 0, 0, 0)
    caixa(g, l, a, 0.01, variante(m, -0.1), 0, 0, -p / 2 + 0.005, 0)
    caixa(g, l, e, p, m, 0, a - e, 0, 0)
    // Gavetas embaixo, cabideiro no meio, prateleira com caixas em cima.
    caixa(g, l - 2 * e, 0.45, p - 0.02, m, 0, 0, 0.01, 0)
    gavetas(g, l - 2 * e, 0.02, 0.43, p / 2, m, 2)
    const prat = a - 0.38
    caixa(g, l - 2 * e, e, p, m, 0, prat, 0, 0)
    for (let x = -l / 2 + 0.06; x < l / 2 - 0.2; x += 0.24 + r() * 0.1)
      caixa(g, 0.2, 0.22, p * 0.7, padrao(['#d9d1c3', '#efece6', '#b5895c', '#9a9894'][Math.floor(r() * 4)], 0.8), x + 0.1, prat + e, 0, 0.01)
    const barra = malha(g, new THREE.CylinderGeometry(0.012, 0.012, l - 2 * e, 12), fixos.cromado, 0, prat - 0.06, 0)
    barra.rotation.z = Math.PI / 2
    const roupas = ['#2b2b2d', '#efece6', '#44566b', '#b0603a', '#d8c6a9', '#6f7d5c', '#c9a043', '#9a9894', '#d8b1a4', '#1f2a44']
    for (let x = -l / 2 + e + 0.04; x < l / 2 - e - 0.03; x += 0.035 + r() * 0.03) {
      const comp = 0.55 + r() * 0.5
      const peca = caixa(g, 0.02, comp, p * 0.72, padrao(roupas[Math.floor(r() * roupas.length)], 0.9), x, prat - 0.08 - comp, 0, 0.008)
      peca.rotation.z = (r() - 0.5) * 0.06
    }
  },

  sapateira(g, { l, p, a }, mat, r) {
    const m = mat('corpo')
    const e = 0.022
    caixa(g, e, a, p, m, -l / 2 + e / 2, 0, 0, 0)
    caixa(g, e, a, p, m, l / 2 - e / 2, 0, 0, 0)
    caixa(g, l, a, 0.01, variante(m, -0.1), 0, 0, -p / 2 + 0.005, 0)
    const n = Math.max(2, Math.round(a / 0.22))
    const sapatos = ['#2b2b2d', '#6e3520', '#efece6', '#a8622f', '#44566b', '#b5643e']
    for (let i = 0; i <= n; i++) {
      const y = Math.min((a - e) * (i / n), a - e)
      caixa(g, l - 2 * e, e, p, m, 0, y, 0, 0)
      if (i === n) break
      for (let x = -l / 2 + 0.08; x < l / 2 - 0.08; x += 0.2) {
        const c = padrao(sapatos[Math.floor(r() * sapatos.length)], 0.5)
        for (const dx of [-0.035, 0.035]) caixa(g, 0.06, 0.08, 0.24, c, x + dx + 0.04, y + e, 0.02, 0.025)
      }
    }
  },

  'ilha-closet'(g, { l, p, a }, mat) {
    const m = mat('corpo')
    caixa(g, l, a - 0.03, p, m, 0, 0, 0, 0.003)
    for (const lado of [1, -1]) {
      const n = Math.max(2, Math.round(l / 0.5))
      for (let i = 0; i < n; i++) {
        const lw = l / n
        const g2 = new THREE.Group()
        gavetas(g2, lw, 0.02, a - 0.06, 0, m, 3, -l / 2 + lw * (i + 0.5))
        g2.position.z = (lado * p) / 2
        if (lado < 0) g2.rotation.y = Math.PI
        g.add(g2)
      }
    }
    caixa(g, l, 0.012, p, fixos.vidro, 0, a - 0.03, 0, 0)
  },

  'espelho-chao'(g, { l, p, a }, mat) {
    const grupo = new THREE.Group()
    caixa(grupo, l, a, p * 0.5, mat('moldura'), 0, 0, 0, 0.004)
    caixa(grupo, l - 0.04, a - 0.04, 0.004, fixos.espelho, 0, 0.02, p * 0.25, 0)
    grupo.rotation.x = -0.06
    grupo.position.z = p * 0.2
    g.add(grupo)
  },

  escrivaninha(g, { l, p, a }, mat) {
    caixa(g, l, 0.03, p, mat('corpo'), 0, a - 0.03, 0, 0.004)
    const pe = mat('metal')
    for (const x of [-1, 1]) {
      const px = x * (l / 2 - 0.05)
      caixa(g, 0.03, a - 0.03, 0.03, pe, px, 0, -p / 2 + 0.06, 0.003)
      caixa(g, 0.03, a - 0.03, 0.03, pe, px, 0, p / 2 - 0.06, 0.003)
      caixa(g, 0.03, 0.03, p - 0.12, pe, px, a - 0.06, 0, 0.003)
    }
    caixa(g, l - 0.1, 0.03, 0.03, pe, 0, a - 0.06, -p / 2 + 0.06, 0.003)
  },

  quadro(g, { l, a, p }, mat) {
    caixa(g, l, a, p, mat('moldura'), 0, 0, 0, 0.002)
    const arte = mat('arte') as THREE.MeshStandardMaterial
    const tela = new THREE.MeshStandardMaterial({ map: obraDeArte('#' + arte.color.getHexString()), roughness: 0.85 })
    malha(g, new THREE.PlaneGeometry(l - 0.05, a - 0.05), tela, 0, a / 2, p / 2 + 0.001)
  },

  pendente(g, { l, a }, mat) {
    const r = l / 2
    const cupula = malha(g, new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('metal'), 0, 0, 0)
    cupula.material = (mat('metal') as THREE.MeshStandardMaterial).clone()
    ;(cupula.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
    esfera(g, 0.045, fixos.luz, 0, 0.04, 0).castShadow = false
    cilindro(g, 0.003, 0.003, a - r, fixos.preto, 0, r, 0, 6).castShadow = false
    const dentroCupula = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.97, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffd9a0', emissiveIntensity: 0.6, side: THREE.BackSide }),
    )
    g.add(dentroCupula)
  },

  'luminaria-piso'(g, { l, a }, mat) {
    cilindro(g, l / 2 - 0.04, l / 2, 0.025, mat('metal'))
    cilindro(g, 0.01, 0.01, a - 0.3, mat('metal'), 0, 0.025, 0, 10)
    const cup = malha(g, new THREE.CylinderGeometry(l / 2 - 0.08, l / 2, 0.28, 32, 1, true), mat('tecido'), 0, a - 0.14, 0)
    cup.material = (mat('tecido') as THREE.MeshStandardMaterial).clone()
    const cm = cup.material as THREE.MeshStandardMaterial
    cm.side = THREE.DoubleSide
    cm.emissive = new THREE.Color('#ffcf8a')
    cm.emissiveIntensity = 0.25
    esfera(g, 0.04, fixos.luz, 0, a - 0.17, 0).castShadow = false
  },

  planta(g, { l, a }, mat, r) {
    const altVaso = Math.min(0.45, a * 0.33)
    cilindro(g, l * 0.3, l * 0.22, altVaso, mat('vaso'), 0, 0, 0, 32)
    malha(g, new THREE.TorusGeometry(l * 0.3, 0.008, 8, 40), mat('vaso'), 0, altVaso, 0).rotation.x = Math.PI / 2
    cilindro(g, l * 0.29, l * 0.29, 0.01, fixos.terra, 0, altVaso - 0.025, 0, 32)
    folhas(g, mat('folhas'), r, l / 2, altVaso, a)
  },

  arvore(g, { l, a }, mat, r) {
    const tronco = cilindro(g, 0.07, 0.14, a * 0.55, fixos.tronco, 0, 0, 0, 12)
    tronco.rotation.z = 0.04
    for (let i = 0; i < 3; i++) {
      const galho = cilindro(g, 0.025, 0.05, a * 0.22, fixos.tronco, 0, a * (0.38 + i * 0.07), 0, 8)
      galho.rotation.set((r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.4)
    }
    copa(g, mat('folhas'), r, l / 2, a * 0.42, a, 11)
  },

  arbusto(g, { l, p, a }, mat, r) {
    const f = mat('folhas')
    const n = Math.max(1, Math.round(l / 0.5))
    for (let i = 0; i < n; i++) {
      const x = -l / 2 + (l / n) * (i + 0.5)
      for (let k = 0; k < 3; k++) {
        const raio = Math.min(a, p, l / n) * (0.45 + r() * 0.2)
        tufo(g, raio, folhagemMat(f, (r() - 0.5) * 0.3), x + (r() - 0.5) * 0.15, raio * 0.75 + r() * 0.1, (r() - 0.5) * p * 0.3, r)
      }
    }
  },

  jardineira(g, m, mat, r) {
    const h = m.a * 0.55
    caixa(g, m.l, h, m.p, mat('alvenaria'), 0, 0, 0, 0.004)
    caixa(g, m.l - 0.06, 0.01, m.p - 0.06, fixos.terra, 0, h, 0, 0)
    const g2 = new THREE.Group()
    construtores.arbusto(g2, { l: m.l - 0.1, p: m.p - 0.08, a: m.a - h }, mat, r)
    g2.position.y = h - 0.05
    g.add(g2)
  },

  poste(g, { l, a }, mat) {
    cilindro(g, l / 2, l / 2, 0.04, mat('metal'))
    caixa(g, 0.06, a - 0.12, 0.06, mat('metal'), 0, 0.04, 0, 0.003)
    caixa(g, 0.1, 0.1, 0.1, fixos.luz, 0, a - 0.12, 0, 0.004).castShadow = false
    caixa(g, 0.14, 0.02, 0.14, mat('metal'), 0, a - 0.02, 0, 0.003)
  },
}

/** Folhagem num tom próximo da cor escolhida, com um leve brilho de folha. */
function folhagemMat(base: Mat, t: number) {
  const m = variante(base, t) as THREE.MeshStandardMaterial
  m.roughness = 0.7
  m.side = THREE.DoubleSide
  return m
}

/** Tufo de folhas: esfera irregular e macia (sem facetas). */
function tufo(g: THREE.Group, raio: number, mat: Mat, x: number, y: number, z: number, r: () => number) {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(raio, 3)
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const pos = geo.getAttribute('position')
  const [f1, f2, f3] = [r() * 6, r() * 6, r() * 6]
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const k = 1 + 0.11 * Math.sin(n.x * 7 + f1) * Math.sin(n.y * 6 + f2) + 0.07 * Math.sin(n.z * 11 + f3)
    v.multiplyScalar(k)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  const m = malha(g, geo, mat, x, y, z)
  m.scale.y = 0.85
  return m
}

/** Copa de árvore: vários tufos em tons próximos. */
function copa(g: THREE.Group, base: Mat, r: () => number, raio: number, y0: number, y1: number, n: number) {
  const meio = (y0 + y1) / 2
  const altura = y1 - y0
  for (let i = 0; i < n; i++) {
    const ang = r() * Math.PI * 2
    const d = r() * raio * 0.55
    const tam = Math.min(raio * (0.38 + r() * 0.28), altura * 0.4)
    const y = Math.min(meio + (r() - 0.5) * altura * 0.5, y1 - tam * 0.7)
    tufo(g, tam, folhagemMat(base, (r() - 0.5) * 0.35), Math.cos(ang) * d, y, Math.sin(ang) * d, r)
  }
}

/** Folha lanceolada, curvada para fora (comprimento no eixo +Y antes de girar). */
function geometriaFolha(comp: number, larg: number) {
  const forma = new THREE.Shape()
  forma.moveTo(0, 0)
  forma.bezierCurveTo(larg, comp * 0.25, larg * 0.9, comp * 0.7, 0, comp)
  forma.bezierCurveTo(-larg * 0.9, comp * 0.7, -larg, comp * 0.25, 0, 0)
  const geo = new THREE.ShapeGeometry(forma, 8)
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / comp
    const x = pos.getX(i) / larg
    // Curva para trás ao longo do comprimento e dobra no meio (nervura).
    pos.setZ(i, -y * y * comp * 0.35 + Math.abs(x) * larg * 0.25)
  }
  geo.computeVertexNormals()
  return geo
}

/** Planta de folhas longas saindo do vaso, abertas em leque. */
function folhas(g: THREE.Group, base: Mat, r: () => number, raio: number, y0: number, y1: number) {
  const altura = y1 - y0
  const n = Math.round(26 + altura * 18)
  for (let i = 0; i < n; i++) {
    const comp = altura * (0.45 + r() * 0.5)
    const folha = new THREE.Mesh(geometriaFolha(comp, Math.min(raio * 0.32, comp * 0.18)), folhagemMat(base, (r() - 0.55) * 0.4))
    folha.castShadow = true
    folha.receiveShadow = true
    const ang = (i / n) * Math.PI * 2 * 3.7 + r()
    const abertura = 0.15 + r() * 0.75
    folha.position.set(Math.cos(ang) * raio * 0.08, y0 + r() * altura * 0.15, Math.sin(ang) * raio * 0.08)
    folha.rotation.set(0, -ang + Math.PI / 2, 0, 'YXZ')
    folha.rotateX(abertura)
    g.add(folha)
  }
}

/** Almofada fofa: caixa bem arredondada e achatada nas pontas. */
function almofada(g: THREE.Group, lado: number, mat: Mat, x: number, y: number, z: number) {
  const m = malha(g, new RoundedBoxGeometry(lado, lado, 0.14, 4, 0.06), mat, x, y, z)
  m.scale.set(1, 1, 1)
  return m
}

/**
 * Junta as malhas da peça que usam o mesmo material numa só: um closet com cem roupas vira
 * uns poucos desenhos para a placa de vídeo, em vez de centenas.
 */
function fundir(g: THREE.Group) {
  g.updateMatrixWorld(true)
  const grupos = new Map<string, { mat: Mat; sombra: boolean; geos: THREE.BufferGeometry[] }>()
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
    for (const nome of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(nome)) geo.deleteAttribute(nome)
    if (!geo.getAttribute('uv')) geo = projetarUV(geo)
    geo.applyMatrix4(m.matrixWorld)
    const chave = `${m.material.uuid}${m.castShadow}`
    if (!grupos.has(chave)) grupos.set(chave, { mat: m.material, sombra: m.castShadow, geos: [] })
    grupos.get(chave)!.geos.push(geo)
    m.geometry.dispose()
  })
  g.clear()
  for (const { mat, sombra, geos } of grupos.values()) {
    const geo = mergeGeometries(geos)
    geos.forEach((x) => x.dispose())
    if (!geo) continue
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = sombra
    m.receiveShadow = true
    g.add(m)
  }
}

const obras = new Map<string, THREE.CanvasTexture>()
/** Pintura abstrata nos tons da cor escolhida. */
function obraDeArte(cor: string) {
  if (obras.has(cor)) return obras.get(cor)!
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const base = new THREE.Color(cor)
  const tom = (t: number) => '#' + base.clone().lerp(new THREE.Color(t > 0 ? '#ffffff' : '#000000'), Math.abs(t)).getHexString()
  g.fillStyle = '#efe9df'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = tom(0.55)
  g.fillRect(0, 150, 256, 106)
  g.fillStyle = cor
  g.beginPath()
  g.arc(150, 120, 62, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = tom(-0.35)
  g.beginPath()
  g.moveTo(30, 256)
  g.quadraticCurveTo(70, 90, 120, 256)
  g.fill()
  g.strokeStyle = tom(-0.5)
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(180, 40)
  g.bezierCurveTo(230, 90, 160, 160, 220, 230)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  obras.set(cor, t)
  return t
}

// --- Montagem ----------------------------------------------------------------

/** Acabamento de uma parte: a opção da paleta com aquele hex, ou uma cor livre no mesmo tipo de textura. */
function materialDaParte(peca: Peca, parte: string, hex: string | undefined) {
  const pt = peca.partes.find((p) => p.id === parte)
  if (!pt) return padrao(hex ?? '#cccccc')
  const cor = hex ?? pt.cores[0].hex
  const opcao = pt.cores.find((c) => c.hex === cor)
  const mesmaTextura = pt.cores.every((c) => c.textura === pt.cores[0].textura) ? pt.cores[0].textura : undefined
  const m = acabamentoDe(opcao ?? { nome: '', hex: cor, textura: mesmaTextura, metal: pt.cores[0].metal })
  m.userData.hex = cor
  return m
}

/** Monta a peça nas medidas (cm) e cores escolhidas. */
export function criarPeca(slug: string, medidas: Medidas, cores: Record<string, string> = {}) {
  const peca = buscarPeca(slug)
  const g = new THREE.Group()
  if (!peca) return g
  const m = { l: medidas.l / 100, p: medidas.p / 100, a: medidas.a / 100 }
  const materiais = new Map<string, Mat>()
  const mat = (parte: string) => {
    if (!materiais.has(parte)) materiais.set(parte, materialDaParte(peca, parte, cores[parte]))
    return materiais.get(parte)!
  }
  const semente = [...slug].reduce((s, c) => s + c.charCodeAt(0), 0) * 97 + Math.round(medidas.l)
  construtores[slug]?.(g, m, mat, sorteio(semente))
  fundir(g)
  return g
}

/** Libera geometrias e materiais próprios da peça (as texturas ficam no cache). */
export function descartarPeca(obj: THREE.Object3D) {
  const fixosSet = new Set<Mat>([...Object.values(fixos), ...padroes.values()])
  obj.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    for (const mat of [m.material].flat()) if (!fixosSet.has(mat)) mat.dispose()
  })
}

// --- Miniaturas --------------------------------------------------------------

let estudio: { renderer: THREE.WebGLRenderer; cena: THREE.Scene; camera: THREE.PerspectiveCamera } | null = null
const miniaturas = new Map<string, string>()

/** Foto da peça para o catálogo do editor, renderizada uma vez e guardada. */
export function miniaturaPeca(slug: string) {
  if (miniaturas.has(slug)) return miniaturas.get(slug)!
  const peca = buscarPeca(slug)
  if (!peca) return ''
  if (!estudio) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(240, 240)
    renderer.toneMapping = THREE.NeutralToneMapping
    const cena = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    cena.environmentIntensity = 0.5
    cena.add(new THREE.HemisphereLight('#ffffff', '#cfc5b6', 1.1))
    const sol = new THREE.DirectionalLight('#fff6ea', 1.6)
    sol.position.set(2, 4, 3)
    cena.add(sol)
    estudio = { renderer, cena, camera: new THREE.PerspectiveCamera(30, 1, 0.01, 100) }
  }
  const { renderer, cena, camera } = estudio
  const obj = criarPeca(slug, peca.medidas, coresPadrao(peca))
  cena.add(obj)
  const box = new THREE.Box3().setFromObject(obj)
  const centro = box.getCenter(new THREE.Vector3())
  const raio = box.getSize(new THREE.Vector3()).length() / 2
  const plano = peca.rasteira
  const dir = plano ? new THREE.Vector3(0.4, 1.4, 1).normalize() : new THREE.Vector3(0.7, 0.45, 1).normalize()
  camera.position.copy(centro).addScaledVector(dir, (raio / Math.sin(THREE.MathUtils.degToRad(15))) * 0.92)
  camera.lookAt(centro)
  renderer.render(cena, camera)
  const url = renderer.domElement.toDataURL('image/png')
  cena.remove(obj)
  descartarPeca(obj)
  miniaturas.set(slug, url)
  return url
}
