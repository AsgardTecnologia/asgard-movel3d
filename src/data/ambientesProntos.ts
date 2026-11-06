import type { Acabamento, Ambiente, Canto, Item, Janela, Planta, Porta } from '../lib/ambiente'
import { buscarPeca, coresPadrao, type Medidas } from './pecas'

/**
 * Ambientes prontos da galeria: planta, acabamentos e peças já posicionadas.
 * Coordenadas em cm, x para a direita e y para baixo (vista de cima). Num retângulo, a parede 0 é a do fundo,
 * 1 a da direita, 2 a da frente e 3 a da esquerda; `t` vai de 0 a 1 no sentido em que a parede é desenhada
 * (a 0 da esquerda para a direita, a 1 de cima para baixo, a 2 da direita para a esquerda, a 3 de baixo para cima).
 * Giro 0: a frente da peça aponta para baixo (para a parede 2); 180 para o fundo; 90 para a esquerda; 270 para a direita.
 */
export type AmbientePronto = Omit<Ambiente, 'etapa' | 'acabamento'> & {
  id: string
  nome: string
  resumo: string
  acabamento: Partial<Acabamento>
  /** Foto do ambiente para o card (gerada pela própria cena: ver `#/ambiente/foto/<id>`). */
  foto?: string
}

const fotos = import.meta.glob<string>('../assets/ambientes/*.jpg', { eager: true, query: '?url', import: 'default' })
const fotoDe = (id: string) => fotos[`../assets/ambientes/${id}.jpg`]

const ret = (l: number, a: number): Canto[] =>
  [
    [0, 0],
    [l, 0],
    [l, a],
    [0, a],
  ].map(([x, y]) => ({ x, y, raio: 0 }))

const poligono = (pts: number[][]): Canto[] => pts.map(([x, y]) => ({ x, y, raio: 0 }))

let seq = 0
const porta = (parede: number, t: number, largura = 80, altura?: number): Porta => ({ id: `p${seq++}`, parede, t, largura, altura })
const janela = (parede: number, t: number, largura: number, altura: number, peitoril: number): Janela => ({
  id: `j${seq++}`,
  parede,
  t,
  largura,
  altura,
  peitoril,
})

const planta = (cantos: Canto[], peDireito: number, extra: Partial<Planta> = {}): Planta => ({
  formato: 'retangulo',
  cantos,
  portas: [],
  janelas: [],
  peDireito,
  ...extra,
})

type Opcoes = Partial<Medidas> & { cores?: Record<string, string>; elevacao?: number }

/** Peça de ambientação em (x, y), com medidas e cores opcionais. */
const peca = (slug: string, x: number, y: number, giro = 0, o: Opcoes = {}): Item => {
  const p = buscarPeca(slug)
  if (!p) throw new Error(`Peça não encontrada: ${slug}`)
  const { cores, elevacao, ...medidas } = o
  return {
    id: '',
    slug,
    cor: 0,
    x,
    y,
    giro,
    elevacao: elevacao ?? p.elevacao,
    medidas: { ...p.medidas, ...medidas },
    cores: { ...coresPadrao(p), ...cores },
  }
}

/** Móvel do catálogo da loja (.glb), na cor `cor`. */
const movel = (slug: string, x: number, y: number, giro = 0, cor = 0, elevacao?: number): Item => ({
  id: '',
  slug,
  cor,
  x,
  y,
  giro,
  elevacao,
})

// Cores usadas com frequência.
const FREIJO = '#b5895c'
const CARVALHO = '#c9a57c'
const NOGUEIRA = '#6e4a33'
const OFF = '#e6dfd2'
const GRAFITE = '#3d4045'
const PRETO = '#2a2a2c'
const QUARTZO = '#eceae5'

const prontos: Omit<AmbientePronto, 'foto'>[] = [
  {
    id: 'fachada',
    nome: 'Fachada',
    resumo: 'Casa térrea contemporânea com ripado, pedra e jardim.',
    planta: planta(
      poligono([
        [0, 0],
        [1200, 0],
        [1200, 750],
        [650, 750],
        [650, 560],
        [0, 560],
      ]),
      320,
      {
        formato: 'l',
        fachada: true,
        grama: true,
        portas: [porta(4, 0.25, 110, 240)],
        janelas: [janela(2, 0.5, 380, 220, 30), janela(4, 0.68, 260, 140, 90), janela(1, 0.45, 200, 120, 100)],
      },
    ),
    acabamento: {
      paredes: '#f1efea',
      porParede: { 2: '#9a6b45', 3: '#a59d90' },
      papelPorParede: { 2: 'ripado', 3: 'pedra' },
      piso: 'cimento',
      corPiso: '#c9c4bb',
      esquadrias: '#232325',
      portas: '#b5895c',
    },
    itens: [
      peca('jardineira', 200, 592, 0, { l: 300 }),
      peca('planta', 395, 600, 0, { a: 150, cores: { vaso: '#222222' } }),
      peca('poste', 415, 690),
      peca('poste', 560, 690),
      peca('arbusto', 925, 800, 0, { l: 300 }),
      peca('arbusto', 1265, 640, 90, { l: 180 }),
      peca('arvore', 180, 880, 0, { a: 460 }),
      peca('arvore', 1420, 260, 0, { a: 400, cores: { folhas: '#7b9a4f' } }),
    ],
  },
  {
    id: 'banheiro',
    nome: 'Banheiro',
    resumo: 'Mármore, gabinete suspenso em freijó e box de vidro.',
    planta: planta(ret(300, 250), 260, {
      vista: { de: { x: 272, y: 228 }, para: { x: 80, y: 70, h: 105 } },
      portas: [porta(2, 0.6)],
      janelas: [janela(1, 0.75, 60, 50, 170)],
    }),
    acabamento: {
      paredes: '#efede8',
      porParede: { 0: '#ece9e4', 1: '#ece9e4' },
      papelPorParede: { 0: 'marmore', 1: 'marmore' },
      piso: 'porcelanato',
      corPiso: '#55575a',
      esquadrias: '#232325',
    },
    itens: [
      peca('box', 252, 52, 0, { l: 95, cores: { metal: PRETO } }),
      peca('gabinete', 95, 25, 0, { l: 100, cores: { corpo: FREIJO, tampo: QUARTZO } }),
      peca('espelho-redondo', 95, 3, 0, { cores: { moldura: PRETO } }),
      peca('vaso-sanitario', 34, 160, 270),
      peca('tapete', 95, 85, 0, { l: 70, p: 45, cores: { tecido: '#9a9894' } }),
      peca('planta', 270, 222, 0, { l: 35, p: 35, a: 60 }),
      peca('toalheiro', 5, 60, 270, { cores: { tecido: '#efece6', metal: '#2a2a2c' } }),
      peca('kit-banho', 128, 18, 0, { elevacao: 85, cores: { louca: '#2b2b2d' } }),
    ],
  },
  {
    id: 'quarto',
    nome: 'Quarto',
    resumo: 'Cama queen de madeira, cabeceira em sálvia e luz de abajur.',
    planta: planta(ret(450, 400), 270, {
      vista: { de: { x: 300, y: 388 }, para: { x: 190, y: 60, h: 85 } },
      portas: [porta(2, 0.5)],
      janelas: [janela(1, 0.5, 140, 130, 90)],
    }),
    acabamento: {
      paredes: '#e6dccb',
      porParede: { 0: '#8a9a7b' },
      papelPorParede: { 0: 'linho' },
      piso: 'madeira',
      corPiso: '#d6b88e',
      esquadrias: '#f4f3ef',
    },
    itens: [
      movel('cama-queen-madeira', 225, 108, 0, 0),
      peca('criado-mudo', 85, 22, 0, { cores: { corpo: FREIJO } }),
      peca('criado-mudo', 365, 22, 0, { cores: { corpo: FREIJO } }),
      movel('abajur-madeira', 85, 22, 0, 0, 55),
      movel('abajur-madeira', 365, 22, 0, 0, 55),
      peca('quadro', 225, 3, 0, { l: 120, a: 60, elevacao: 130, cores: { arte: '#d8c6a9' } }),
      peca('guarda-roupa', 31, 240, 270, { l: 180, cores: { corpo: OFF } }),
      peca('tapete', 225, 240, 0, { l: 240, p: 150, cores: { tecido: '#d9d1c3' } }),
      movel('poltrona-couro', 385, 300, 90, 3),
      peca('cortina', 442, 115, 90, { l: 60, a: 260, cores: { tecido: '#d9d1c3' } }),
      peca('cortina', 442, 285, 90, { l: 60, a: 260, cores: { tecido: '#d9d1c3' } }),
      peca('planta', 40, 372, 0, { a: 110 }),
      peca('banco-peseira', 225, 236, 0, { cores: { estrutura: NOGUEIRA, tecido: '#8a9a7b' } }),
      peca('livros', 72, 28, 10, { elevacao: 55, cores: { capa: '#d8c6a9' } }),
      peca('vasos-decor', 372, 28, 0, { elevacao: 55, l: 22, cores: { vaso: '#efece6' } }),
    ],
  },
  {
    id: 'cozinha',
    nome: 'Cozinha',
    resumo: 'Marcenaria sálvia, quartzo branco e ilha com banquetas.',
    planta: planta(ret(420, 360), 270, {
      vista: { de: { x: 395, y: 340 }, para: { x: 150, y: 50, h: 105 } },
      portas: [porta(2, 0.15)],
      janelas: [janela(3, 0.5, 120, 110, 110)],
    }),
    acabamento: {
      paredes: '#f2efe9',
      porParede: { 0: '#f4f2ee' },
      papelPorParede: { 0: 'azulejo' },
      piso: 'porcelanato',
      corPiso: '#a9a8a4',
      esquadrias: '#232325',
    },
    itens: [
      peca('geladeira', 38, 38),
      peca('bancada-pia', 165, 31, 0, { l: 180, cores: { corpo: '#8f9c80', tampo: QUARTZO } }),
      peca('bancada-cooktop', 300, 31, 0, { l: 90, cores: { corpo: '#8f9c80', tampo: QUARTZO } }),
      peca('bancada', 380, 31, 0, { l: 70, cores: { corpo: '#8f9c80', tampo: QUARTZO } }),
      peca('armario-aereo', 165, 19, 0, { l: 180, cores: { corpo: FREIJO } }),
      peca('armario-aereo', 380, 19, 0, { l: 70, cores: { corpo: FREIJO } }),
      peca('coifa', 300, 26, 0, { elevacao: 160 }),
      peca('ilha', 215, 215, 0, { l: 200, cores: { corpo: FREIJO, tampo: QUARTZO } }),
      peca('banqueta', 155, 285),
      peca('banqueta', 215, 285),
      peca('banqueta', 275, 285),
      peca('pendente', 165, 215, 0, { cores: { metal: PRETO } }),
      peca('pendente', 215, 215, 0, { cores: { metal: PRETO } }),
      peca('pendente', 265, 215, 0, { cores: { metal: PRETO } }),
      peca('planta', 40, 320, 0, { a: 90 }),
      peca('fruteira', 250, 212, 0, { elevacao: 92, cores: { tigela: '#efece6' } }),
      peca('utensilios', 380, 20, 0, { elevacao: 90, cores: { tabua: FREIJO } }),
      peca('vasos-decor', 175, 215, 0, { elevacao: 92, cores: { vaso: '#b5643e' } }),
    ],
  },
  {
    id: 'area-gourmet',
    nome: 'Área Gourmet',
    resumo: 'Churrasqueira, ilha, mesa para oito e piscina com deck.',
    planta: planta(ret(900, 700), 300, {
      vista: { de: { x: 870, y: 680 }, para: { x: 230, y: 120, h: 105 } },
      grama: true,
      alturas: { 1: 0, 2: 0 },
      portas: [porta(3, 0.8, 90)],
    }),
    acabamento: {
      paredes: '#ece6dc',
      porParede: { 0: '#b0613f', 3: '#9a6b45' },
      papelPorParede: { 0: 'tijolinho', 3: 'ripado' },
      piso: 'porcelanato',
      corPiso: '#e8e3da',
      portas: '#6e4a33',
    },
    itens: [
      peca('churrasqueira', 90, 34, 0, { l: 130, cores: { alvenaria: '#2e2e30', tampo: PRETO } }),
      peca('bancada-pia', 255, 31, 0, { l: 200, cores: { corpo: GRAFITE, tampo: PRETO } }),
      peca('bancada', 435, 31, 0, { l: 160, cores: { corpo: GRAFITE, tampo: PRETO } }),
      peca('geladeira', 555, 38),
      peca('ilha', 330, 200, 0, { l: 260, p: 100, cores: { corpo: FREIJO, tampo: PRETO } }),
      peca('banqueta', 230, 275),
      peca('banqueta', 290, 275),
      peca('banqueta', 350, 275),
      peca('banqueta', 410, 275),
      peca('pendente', 260, 200, 0, { elevacao: 190, cores: { metal: PRETO } }),
      peca('pendente', 330, 200, 0, { elevacao: 190, cores: { metal: PRETO } }),
      peca('pendente', 400, 200, 0, { elevacao: 190, cores: { metal: PRETO } }),
      peca('mesa', 190, 420, 0, { l: 220, p: 100 }),
      ...[120, 190, 260].flatMap((x) => [peca('cadeira', x, 342, 0), peca('cadeira', x, 498, 180)]),
      peca('cadeira', 55, 420, 270),
      peca('cadeira', 325, 420, 90),
      peca('deck', 220, 600, 0, { l: 320, p: 190 }),
      peca('sofa', 220, 650, 180, { l: 200, cores: { tecido: '#d9d1c3' } }),
      peca('mesa-centro', 220, 565),
      peca('puff', 105, 565, 0, { cores: { tecido: '#b5643e' } }),
      peca('puff', 335, 565, 0, { cores: { tecido: '#6f7d5c' } }),
      peca('piscina', 655, 560, 0, { l: 460, p: 260 }),
      peca('espreguicadeira', 500, 325),
      peca('espreguicadeira', 580, 325),
      peca('guarda-sol', 770, 300, 0, { l: 240, p: 240, cores: { tecido: '#efece6' } }),
      peca('planta', 870, 40, 0, { a: 160 }),
      peca('planta', 30, 670, 0, { a: 140, l: 50, p: 50 }),
      peca('fruteira', 190, 420, 0, { elevacao: 76, cores: { tigela: '#b5643e' } }),
      peca('bandeja-decor', 220, 565, 0, { elevacao: 38, cores: { metal: '#b5895c' } }),
      peca('utensilios', 450, 20, 0, { elevacao: 90, cores: { tabua: FREIJO } }),
      peca('almofadas', 220, 662, 180, { l: 150, cores: { tecido: '#b5643e' } }),
    ],
  },
  {
    id: 'lavanderia',
    nome: 'Lavanderia',
    resumo: 'Lava e seca empilhadas, tanque e armários azul petróleo.',
    planta: planta(ret(300, 220), 260, {
      vista: { de: { x: 270, y: 195 }, para: { x: 95, y: 30, h: 105 } },
      portas: [porta(2, 0.5)],
      janelas: [janela(3, 0.5, 80, 80, 120)],
    }),
    acabamento: {
      paredes: '#eef0ec',
      porParede: { 0: '#f4f2ee' },
      papelPorParede: { 0: 'azulejo' },
      piso: 'porcelanato',
      corPiso: '#e8e3da',
    },
    itens: [
      peca('maquina-lavar', 36, 33, 0, { cores: { metal: '#f2f2f0' } }),
      peca('secadora', 36, 33, 0, { elevacao: 85, cores: { metal: '#f2f2f0' } }),
      peca('tanque', 100, 30),
      peca('bancada', 190, 31, 0, { l: 110, cores: { corpo: '#2f4b57', tampo: QUARTZO } }),
      peca('armario-alto', 272, 32, 0, { l: 50, cores: { corpo: '#2f4b57' } }),
      peca('armario-aereo', 190, 19, 0, { l: 110, cores: { corpo: '#2f4b57' } }),
      peca('armario-aereo', 100, 19, 0, { l: 60, cores: { corpo: '#2f4b57' } }),
      peca('cesto', 262, 175),
      peca('kit-banho', 200, 22, 0, { elevacao: 90, cores: { louca: '#f5f5f2' } }),
      peca('planta', 210, 200, 0, { l: 35, p: 35, a: 70, cores: { vaso: '#b5643e' } }),
    ],
  },
  {
    id: 'escritorio',
    nome: 'Escritório',
    resumo: 'Home office com estante, cadeira ergonômica e canto de leitura.',
    planta: planta(ret(400, 350), 270, {
      vista: { de: { x: 235, y: 335 }, para: { x: 160, y: 40, h: 105 } },
      portas: [porta(2, 0.5)],
      janelas: [janela(0, 0.5, 160, 130, 100)],
    }),
    acabamento: {
      paredes: '#dcd6cc',
      porParede: { 3: '#9a6b45' },
      papelPorParede: { 3: 'ripado' },
      piso: 'madeira',
      corPiso: '#8f6843',
      esquadrias: '#232325',
    },
    itens: [
      peca('escrivaninha', 200, 36, 0, { l: 150, cores: { corpo: CARVALHO, metal: PRETO } }),
      movel('cadeira-escritorio', 200, 118, 180, 0),
      movel('gaveteiro-preto', 312, 40, 0, 0),
      movel('trofeu-horsepower', 312, 30, 0, 1, 64),
      movel('abajur-madeira', 255, 26, 0, 2, 75),
      peca('estante', 19, 200, 270, { l: 120, a: 210, cores: { corpo: GRAFITE } }),
      peca('tapete', 200, 165, 0, { l: 200, p: 140, cores: { tecido: '#4a4c50' } }),
      movel('poltrona-couro', 330, 272, 180, 0),
      peca('luminaria-piso', 378, 200, 0, { cores: { metal: PRETO } }),
      peca('planta', 40, 318, 0, { a: 110 }),
      peca('quadro', 397, 120, 90, { l: 70, a: 90, cores: { arte: '#44566b', moldura: PRETO } }),
      peca('livros', 150, 30, -8, { elevacao: 75, cores: { capa: '#44566b' } }),
      peca('prateleira', 11, 80, 270, { elevacao: 150, cores: { corpo: GRAFITE } }),
      peca('bandeja-decor', 245, 40, 0, { elevacao: 75, l: 28, cores: { metal: PRETO } }),
    ],
  },
  {
    id: 'sala',
    nome: 'Sala',
    resumo: 'Sofá de couro, painel ripado com TV e poltrona de leitura.',
    planta: planta(ret(600, 450), 280, {
      vista: { de: { x: 470, y: 438 }, para: { x: 230, y: 60, h: 110 } },
      portas: [porta(2, 0.88)],
      janelas: [janela(1, 0.5, 220, 160, 50), janela(3, 0.5, 140, 150, 70)],
    }),
    acabamento: {
      paredes: '#ece6dc',
      porParede: { 0: '#9a6b45' },
      papelPorParede: { 0: 'ripado' },
      piso: 'madeira',
      corPiso: '#b98a5a',
      esquadrias: '#232325',
    },
    itens: [
      peca('rack', 300, 25, 0, { l: 200, cores: { corpo: NOGUEIRA } }),
      peca('tv', 300, 4),
      movel('sofa-couro', 300, 385, 180, 2),
      peca('tapete', 300, 255, 0, { l: 260, p: 180, cores: { tecido: '#d9d1c3' } }),
      peca('mesa-centro', 300, 250, 0, { l: 110 }),
      movel('poltrona-couro', 55, 210, 270, 0),
      movel('mesinha-madeira', 60, 320, 0, 1),
      movel('abajur-madeira', 60, 320, 0, 1, 60),
      peca('cortina', 8, 140, 270, { l: 50, a: 270, cores: { tecido: '#efece6' } }),
      peca('cortina', 8, 310, 270, { l: 50, a: 270, cores: { tecido: '#efece6' } }),
      movel('vaso-ficus', 45, 45, 0, 2),
      peca('luminaria-piso', 520, 395),
      peca('cortina', 592, 100, 90, { l: 80, a: 270, cores: { tecido: '#efece6' } }),
      peca('cortina', 592, 350, 90, { l: 80, a: 270, cores: { tecido: '#efece6' } }),
      peca('livros', 278, 248, 15, { elevacao: 38, cores: { capa: '#2b2b2d' } }),
      peca('bandeja-decor', 325, 252, 0, { elevacao: 38, cores: { metal: '#c9a35a' } }),
      peca('vasos-decor', 225, 22, 0, { elevacao: 50, cores: { vaso: '#efece6' } }),
      peca('livros', 380, 25, 0, { elevacao: 50, cores: { capa: '#d8c6a9' } }),
    ],
  },
  {
    id: 'apartamento',

    nome: 'Apartamento',
    resumo: 'Studio integrado: cozinha, jantar para quatro e estar.',
    planta: planta(ret(800, 550), 270, {
      vista: { de: { x: 120, y: 510 }, para: { x: 560, y: 90, h: 105 } },
      portas: [porta(2, 0.9)],
      janelas: [janela(1, 0.5, 200, 150, 60), janela(3, 0.5, 120, 120, 100)],
    }),
    acabamento: {
      paredes: '#ebe5dc',
      porParede: { 0: '#ebe5dc', 1: '#6f7d5c' },
      papelPorParede: {},
      piso: 'madeira',
      corPiso: '#b98a5a',
      esquadrias: '#232325',
    },
    itens: [
      peca('geladeira', 38, 38),
      peca('bancada-pia', 165, 31, 0, { l: 180, cores: { corpo: OFF, tampo: '#2a2a2c' } }),
      peca('bancada-cooktop', 295, 31, 0, { l: 80, cores: { corpo: OFF, tampo: '#2a2a2c' } }),
      peca('armario-aereo', 160, 19, 0, { l: 170, cores: { corpo: FREIJO } }),
      peca('coifa', 295, 26),
      peca('mesa', 200, 300, 0, { l: 160, p: 90, cores: { tampo: FREIJO, metal: PRETO } }),
      peca('cadeira', 160, 233, 0),
      peca('cadeira', 240, 233, 0),
      peca('cadeira', 160, 367, 180),
      peca('cadeira', 240, 367, 180),
      peca('pendente', 170, 300, 0, { elevacao: 175 }),
      peca('pendente', 230, 300, 0, { elevacao: 175 }),
      peca('rack', 600, 25, 0, { l: 200, cores: { corpo: NOGUEIRA } }),
      peca('tv', 600, 4),
      peca('sofa', 600, 505, 180, { l: 230, cores: { tecido: '#9a9894' } }),
      peca('tapete', 600, 330, 0, { l: 260, p: 180, cores: { tecido: '#d9d1c3' } }),
      peca('mesa-centro', 600, 330),
      movel('poltrona-couro', 440, 330, 270, 1),
      peca('planta', 765, 45, 0, { a: 150 }),
      peca('luminaria-piso', 760, 470),
      peca('cortina', 792, 160, 90, { l: 70, a: 260, cores: { tecido: '#efece6' } }),
      peca('cortina', 792, 390, 90, { l: 70, a: 260, cores: { tecido: '#efece6' } }),
      peca('fruteira', 200, 300, 0, { elevacao: 76, cores: { tigela: '#efece6' } }),
      peca('utensilios', 228, 20, 0, { elevacao: 90, cores: { tabua: CARVALHO } }),
      peca('vasos-decor', 530, 22, 0, { elevacao: 50, cores: { vaso: '#b5643e' } }),
      peca('livros', 580, 328, 20, { elevacao: 38, cores: { capa: '#44566b' } }),
      peca('bandeja-decor', 625, 332, 0, { elevacao: 38, cores: { metal: PRETO } }),
    ],
  },
  {
    id: 'closet',
    nome: 'Closet',
    resumo: 'Módulos abertos em freijó, ilha de gavetas e espelho de chão.',
    planta: planta(ret(400, 300), 270, {
      vista: { de: { x: 375, y: 280 }, para: { x: 130, y: 60, h: 115 } },
      portas: [porta(2, 0.25)],
    }),
    acabamento: {
      paredes: '#e3d9cc',
      piso: 'madeira',
      corPiso: '#d6b88e',
    },
    itens: [
      peca('closet', 52, 29, 0, { a: 240, cores: { corpo: FREIJO } }),
      peca('closet', 152, 29, 0, { a: 240, cores: { corpo: FREIJO } }),
      peca('closet', 252, 29, 0, { a: 240, cores: { corpo: FREIJO } }),
      peca('sapateira', 349, 22, 0, { l: 90, cores: { corpo: FREIJO } }),
      peca('closet', 29, 120, 270, { a: 240, cores: { corpo: FREIJO } }),
      peca('closet', 29, 222, 270, { a: 240, cores: { corpo: FREIJO } }),
      peca('tapete', 230, 180, 0, { l: 200, p: 140, cores: { tecido: '#efece6' } }),
      peca('ilha-closet', 230, 170, 0, { l: 140, p: 65, cores: { corpo: OFF } }),
      peca('puff', 230, 245, 0, { cores: { tecido: '#d8b1a4' } }),
      peca('espelho-chao', 396, 150, 90, { cores: { moldura: '#c9a35a' } }),
      peca('pendente', 200, 170, 0, { cores: { metal: '#c9a35a' } }),
      peca('pendente', 260, 170, 0, { cores: { metal: '#c9a35a' } }),
      peca('vasos-decor', 195, 170, 0, { elevacao: 90, l: 26, cores: { vaso: '#efece6' } }),
      peca('bandeja-decor', 265, 170, 0, { elevacao: 90, cores: { metal: '#c9a35a' } }),
    ],
  },
]

export const ambientesProntos: AmbientePronto[] = prontos.map((p) => ({ ...p, foto: fotoDe(p.id) }))

export const buscarPronto = (id: string) => ambientesProntos.find((a) => a.id === id)
