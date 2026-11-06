import type { OpcaoCor } from '../lib/ambiente'

/**
 * Peças de ambientação geradas no próprio 3D (sem arquivo .glb): bancadas, louças, eletros, churrasqueira, piscina…
 * Completam os ambientes prontos ao lado dos móveis do catálogo. Cada parte pode ser pintada.
 */
export type CategoriaPeca =
  | 'Cozinha'
  | 'Banheiro'
  | 'Lavanderia'
  | 'Área externa'
  | 'Sala'
  | 'Quarto'
  | 'Closet'
  | 'Escritório'
  | 'Decoração'
  | 'Jardim'

/** Medidas em cm: largura (x), profundidade (z) e altura. */
export type Medidas = { l: number; p: number; a: number }

export type Parte = { id: string; rotulo: string; cores: OpcaoCor[] }

export type Peca = {
  slug: string
  nome: string
  categoria: CategoriaPeca
  medidas: Medidas
  /** Medidas que a pessoa pode mudar, com mínimo e máximo. */
  ajuste?: Partial<Record<keyof Medidas, [number, number]>>
  partes: Parte[]
  /** O tampo serve de apoio para outras peças (como as mesas do catálogo). */
  apoio?: boolean
  /** Altura padrão da base, em cm (armário aéreo, quadro, TV). */
  elevacao?: number
  /** Fica rente ao chão e pode ser pisada (tapete, deck, piscina): não pede área de uso nem bate nos móveis. */
  rasteira?: boolean
  /** Presa na parede (quadro, TV, cortina): some junto quando a parede abaixa para ver o cômodo por dentro. */
  naParede?: boolean
}

export const categoriasPeca: CategoriaPeca[] = [
  'Cozinha',
  'Banheiro',
  'Lavanderia',
  'Área externa',
  'Sala',
  'Quarto',
  'Closet',
  'Escritório',
  'Decoração',
  'Jardim',
]

// --- Paletas -----------------------------------------------------------------

export const MARCENARIA: OpcaoCor[] = [
  { nome: 'Branco', hex: '#f1efea' },
  { nome: 'Off-white', hex: '#e6dfd2' },
  { nome: 'Freijó', hex: '#b5895c', textura: 'madeira' },
  { nome: 'Carvalho', hex: '#c9a57c', textura: 'madeira' },
  { nome: 'Nogueira', hex: '#6e4a33', textura: 'madeira' },
  { nome: 'Fendi', hex: '#c9bba7' },
  { nome: 'Sálvia', hex: '#8f9c80' },
  { nome: 'Azul petróleo', hex: '#2f4b57' },
  { nome: 'Grafite', hex: '#3d4045' },
  { nome: 'Preto', hex: '#1f1f21' },
]

export const TAMPO: OpcaoCor[] = [
  { nome: 'Granito preto', hex: '#2a2a2c', textura: 'granito' },
  { nome: 'Quartzo branco', hex: '#eceae5', textura: 'granito' },
  { nome: 'Mármore Carrara', hex: '#ece9e4', textura: 'marmore' },
  { nome: 'Travertino', hex: '#d8c6a9', textura: 'marmore' },
  { nome: 'Madeira', hex: '#b5895c', textura: 'madeira' },
  { nome: 'Cimento', hex: '#9a968f', textura: 'cimento' },
]

export const TECIDO: OpcaoCor[] = [
  { nome: 'Linho', hex: '#d9d1c3', textura: 'tecido' },
  { nome: 'Cinza', hex: '#9a9894', textura: 'tecido' },
  { nome: 'Grafite', hex: '#4a4c50', textura: 'tecido' },
  { nome: 'Terracota', hex: '#b5643e', textura: 'tecido' },
  { nome: 'Verde', hex: '#6f7d5c', textura: 'tecido' },
  { nome: 'Azul', hex: '#44566b', textura: 'tecido' },
  { nome: 'Mostarda', hex: '#c9a043', textura: 'tecido' },
  { nome: 'Rosé', hex: '#d8b1a4', textura: 'tecido' },
]

export const METAL: OpcaoCor[] = [
  { nome: 'Inox', hex: '#c9ccd0', metal: true },
  { nome: 'Preto', hex: '#2a2a2c' },
  { nome: 'Branco', hex: '#f2f2f0' },
  { nome: 'Grafite', hex: '#55585d', metal: true },
  { nome: 'Dourado', hex: '#c9a35a', metal: true },
]

export const LOUCA: OpcaoCor[] = [
  { nome: 'Branco', hex: '#f5f5f2' },
  { nome: 'Preto fosco', hex: '#2b2b2d' },
  { nome: 'Cinza', hex: '#a7a7a5' },
  { nome: 'Areia', hex: '#d9cdb8' },
]

export const ALVENARIA: OpcaoCor[] = [
  { nome: 'Tijolinho', hex: '#a95b3c', textura: 'tijolo' },
  { nome: 'Tijolo branco', hex: '#e8e4dc', textura: 'tijolo' },
  { nome: 'Cimento', hex: '#9a968f', textura: 'cimento' },
  { nome: 'Pedra', hex: '#a59d90', textura: 'pedra' },
  { nome: 'Preto', hex: '#2e2e30' },
  { nome: 'Branco', hex: '#efece6' },
]

export const MADEIRA: OpcaoCor[] = MARCENARIA.filter((c) => c.textura === 'madeira').concat([
  { nome: 'Preto', hex: '#1f1f21' },
  { nome: 'Branco', hex: '#f1efea' },
])

export const PISCINA: OpcaoCor[] = [
  { nome: 'Azul piscina', hex: '#3aa6c4' },
  { nome: 'Verde água', hex: '#4fb7a8' },
  { nome: 'Azul profundo', hex: '#2c6f9c' },
  { nome: 'Areia', hex: '#7fc0c0' },
]

export const BORDA: OpcaoCor[] = [
  { nome: 'Pedra São Tomé', hex: '#d8cfb8', textura: 'pedra' },
  { nome: 'Atérmica', hex: '#e6e1d6', textura: 'cimento' },
  { nome: 'Madeira', hex: '#9b6a45', textura: 'madeira' },
  { nome: 'Grafite', hex: '#55575a', textura: 'cimento' },
]

export const VERDE: OpcaoCor[] = [
  { nome: 'Verde', hex: '#4f6b3a' },
  { nome: 'Verde claro', hex: '#7b9a4f' },
  { nome: 'Verde escuro', hex: '#2f4a2a' },
  { nome: 'Florido', hex: '#b9577a' },
]

export const VASO: OpcaoCor[] = [
  { nome: 'Terracota', hex: '#b5643e' },
  { nome: 'Off-white', hex: '#efece6' },
  { nome: 'Preto', hex: '#222222' },
  { nome: 'Cimento', hex: '#8e8b86', textura: 'cimento' },
]

export const ARTE: OpcaoCor[] = [
  { nome: 'Terra', hex: '#b0603a' },
  { nome: 'Oliva', hex: '#6f7d5c' },
  { nome: 'Azul', hex: '#44566b' },
  { nome: 'Areia', hex: '#d8c6a9' },
  { nome: 'P&B', hex: '#2b2b2d' },
]

// --- Peças -------------------------------------------------------------------

const p = (
  slug: string,
  nome: string,
  categoria: CategoriaPeca,
  medidas: Medidas,
  partes: Parte[],
  extra: Partial<Peca> = {},
): Peca => ({ slug, nome, categoria, medidas, partes, ...extra })

const parte = (id: string, rotulo: string, cores: OpcaoCor[]): Parte => ({ id, rotulo, cores })
const corpo = parte('corpo', 'Marcenaria', MARCENARIA)
const tampo = parte('tampo', 'Tampo', TAMPO)
const metal = parte('metal', 'Acabamento', METAL)
const louca = parte('louca', 'Louça', LOUCA)
const tecido = parte('tecido', 'Tecido', TECIDO)
const estrutura = parte('estrutura', 'Estrutura', MADEIRA)
const verde = parte('folhas', 'Folhagem', VERDE)
const vaso = parte('vaso', 'Vaso', VASO)

export const pecas: Peca[] = [
  // Cozinha
  p('bancada', 'Balcão com tampo', 'Cozinha', { l: 160, p: 60, a: 90 }, [corpo, tampo], { ajuste: { l: [40, 400] }, apoio: true }),
  p('bancada-pia', 'Balcão com pia', 'Cozinha', { l: 180, p: 60, a: 90 }, [corpo, tampo], { ajuste: { l: [80, 400] } }),
  p('bancada-cooktop', 'Balcão com cooktop e forno', 'Cozinha', { l: 90, p: 60, a: 90 }, [corpo, tampo], { ajuste: { l: [70, 200] } }),
  p('armario-aereo', 'Armário aéreo', 'Cozinha', { l: 160, p: 35, a: 70 }, [corpo], { ajuste: { l: [40, 400], a: [35, 100] }, elevacao: 150 }),
  p('armario-alto', 'Armário torre', 'Cozinha', { l: 60, p: 60, a: 220 }, [corpo], { ajuste: { l: [40, 200], a: [150, 260] } }),
  p('geladeira', 'Geladeira duplex', 'Cozinha', { l: 70, p: 72, a: 185 }, [metal]),
  p('coifa', 'Coifa de parede', 'Cozinha', { l: 90, p: 50, a: 90 }, [metal], { elevacao: 165 }),
  p('ilha', 'Ilha com tampo', 'Cozinha', { l: 200, p: 90, a: 92 }, [corpo, tampo], { ajuste: { l: [100, 360], p: [60, 130] }, apoio: true }),
  p('banqueta', 'Banqueta alta', 'Cozinha', { l: 40, p: 40, a: 75 }, [parte('assento', 'Assento', MADEIRA.concat(TECIDO.slice(0, 4))), parte('metal', 'Pés', METAL)]),
  // Banheiro
  p('vaso-sanitario', 'Vaso sanitário', 'Banheiro', { l: 38, p: 65, a: 78 }, [louca]),
  p('gabinete', 'Gabinete com cuba', 'Banheiro', { l: 90, p: 48, a: 85 }, [corpo, tampo, louca], { ajuste: { l: [50, 200] } }),
  p('espelho', 'Espelho', 'Banheiro', { l: 70, p: 3, a: 90 }, [parte('moldura', 'Moldura', METAL.concat(MADEIRA.slice(0, 2)))], { ajuste: { l: [30, 200], a: [40, 160] }, elevacao: 105, naParede: true }),
  p('espelho-redondo', 'Espelho redondo', 'Banheiro', { l: 70, p: 3, a: 70 }, [parte('moldura', 'Moldura', METAL.concat(MADEIRA.slice(0, 2)))], { ajuste: { l: [40, 120] }, elevacao: 115, naParede: true }),
  p('box', 'Box com chuveiro', 'Banheiro', { l: 90, p: 100, a: 200 }, [parte('metal', 'Perfis e metais', METAL)], { ajuste: { l: [70, 160], p: [70, 160] } }),
  p('banheira', 'Banheira', 'Banheiro', { l: 170, p: 75, a: 58 }, [louca]),
  // Lavanderia
  p('maquina-lavar', 'Lava e seca', 'Lavanderia', { l: 60, p: 62, a: 85 }, [parte('metal', 'Cor', METAL)], { apoio: true }),
  p('secadora', 'Secadora', 'Lavanderia', { l: 60, p: 62, a: 85 }, [parte('metal', 'Cor', METAL)], { apoio: true }),
  p('tanque', 'Tanque', 'Lavanderia', { l: 60, p: 55, a: 90 }, [louca]),
  p('cesto', 'Cesto de roupas', 'Lavanderia', { l: 40, p: 40, a: 55 }, [parte('cesto', 'Trama', MADEIRA.concat(TECIDO.slice(0, 3)))]),
  // Área externa
  p('churrasqueira', 'Churrasqueira', 'Área externa', { l: 120, p: 65, a: 240 }, [parte('alvenaria', 'Revestimento', ALVENARIA), tampo]),
  p('piscina', 'Piscina', 'Área externa', { l: 600, p: 300, a: 6 }, [parte('agua', 'Pastilha', PISCINA), parte('borda', 'Borda', BORDA)], {
    ajuste: { l: [200, 1200], p: [150, 600] },
    rasteira: true,
  }),
  p('espreguicadeira', 'Espreguiçadeira', 'Área externa', { l: 70, p: 195, a: 40 }, [estrutura, tecido]),
  p('guarda-sol', 'Guarda-sol', 'Área externa', { l: 260, p: 260, a: 245 }, [tecido, estrutura]),
  p('deck', 'Deck de madeira', 'Área externa', { l: 300, p: 200, a: 4 }, [parte('madeira', 'Madeira', MADEIRA)], { ajuste: { l: [100, 1000], p: [100, 800] }, rasteira: true }),
  p('mesa', 'Mesa de jantar', 'Área externa', { l: 200, p: 95, a: 76 }, [parte('tampo', 'Tampo', MADEIRA.concat(TAMPO.slice(0, 4))), parte('metal', 'Pés', METAL.concat(MADEIRA.slice(0, 3)))], {
    ajuste: { l: [80, 300], p: [70, 120] },
    apoio: true,
  }),
  p('cadeira', 'Cadeira de jantar', 'Área externa', { l: 46, p: 52, a: 84 }, [estrutura, tecido]),
  // Sala
  p('sofa', 'Sofá 3 lugares', 'Sala', { l: 220, p: 92, a: 82 }, [tecido, parte('pes', 'Pés', MADEIRA)], { ajuste: { l: [150, 320] } }),
  p('mesa-centro', 'Mesa de centro', 'Sala', { l: 100, p: 60, a: 38 }, [parte('tampo', 'Tampo', MADEIRA.concat(TAMPO.slice(0, 4))), parte('metal', 'Base', METAL)], { apoio: true }),
  p('rack', 'Rack', 'Sala', { l: 180, p: 45, a: 50 }, [corpo], { ajuste: { l: [100, 300] }, apoio: true }),
  p('tv', 'Smart TV 65"', 'Sala', { l: 145, p: 6, a: 84 }, [parte('metal', 'Moldura', METAL.slice(1, 3))], { elevacao: 95, naParede: true }),
  p('estante', 'Estante', 'Sala', { l: 100, p: 35, a: 200 }, [corpo], { ajuste: { l: [60, 300], a: [100, 260] } }),
  p('tapete', 'Tapete', 'Sala', { l: 240, p: 170, a: 1 }, [tecido], { ajuste: { l: [80, 400], p: [60, 400] }, rasteira: true }),
  p('cortina', 'Cortina', 'Sala', { l: 220, p: 12, a: 260 }, [tecido], { ajuste: { l: [80, 500], a: [150, 320] }, naParede: true }),
  p('puff', 'Puff', 'Sala', { l: 50, p: 50, a: 42 }, [tecido]),
  // Quarto
  p('cama-casal', 'Cama de casal', 'Quarto', { l: 168, p: 210, a: 110 }, [estrutura, parte('roupa', 'Roupa de cama', TECIDO)], { ajuste: { l: [100, 210] } }),
  p('criado-mudo', 'Criado-mudo', 'Quarto', { l: 50, p: 40, a: 55 }, [corpo], { apoio: true }),
  p('guarda-roupa', 'Guarda-roupa', 'Quarto', { l: 240, p: 60, a: 230 }, [corpo], { ajuste: { l: [80, 400], a: [180, 270] } }),
  // Closet
  p('closet', 'Módulo de closet', 'Closet', { l: 100, p: 55, a: 230 }, [corpo], { ajuste: { l: [60, 200], a: [180, 270] } }),
  p('sapateira', 'Sapateira', 'Closet', { l: 100, p: 40, a: 110 }, [corpo], { ajuste: { l: [60, 200] }, apoio: true }),
  p('ilha-closet', 'Ilha de closet', 'Closet', { l: 120, p: 60, a: 90 }, [corpo], { ajuste: { l: [80, 200] }, apoio: true }),
  p('espelho-chao', 'Espelho de chão', 'Closet', { l: 60, p: 6, a: 170 }, [parte('moldura', 'Moldura', METAL.concat(MADEIRA.slice(0, 2)))]),
  // Escritório
  p('escrivaninha', 'Escrivaninha', 'Escritório', { l: 140, p: 65, a: 75 }, [corpo, parte('metal', 'Pés', METAL)], { ajuste: { l: [80, 240] }, apoio: true }),
  // Decoração
  p('quadro', 'Quadro', 'Decoração', { l: 80, p: 3, a: 60 }, [parte('arte', 'Arte', ARTE), parte('moldura', 'Moldura', MADEIRA.slice(0, 3).concat(METAL.slice(1, 3)))], {
    ajuste: { l: [30, 200], a: [30, 150] },
    elevacao: 140,
    naParede: true,
  }),
  p('pendente', 'Luminária pendente', 'Decoração', { l: 30, p: 30, a: 90 }, [parte('metal', 'Cúpula', METAL)], { elevacao: 170 }),
  p('luminaria-piso', 'Luminária de piso', 'Decoração', { l: 40, p: 40, a: 165 }, [parte('metal', 'Haste', METAL), tecido]),
  p('planta', 'Planta em vaso', 'Decoração', { l: 50, p: 50, a: 120 }, [verde, vaso], { ajuste: { a: [40, 200] } }),
  // Jardim
  p('arvore', 'Árvore', 'Jardim', { l: 260, p: 260, a: 420 }, [verde], { ajuste: { a: [200, 700] } }),
  p('arbusto', 'Arbusto', 'Jardim', { l: 90, p: 90, a: 80 }, [verde], { ajuste: { l: [40, 300] } }),
  p('jardineira', 'Jardineira', 'Jardim', { l: 200, p: 50, a: 70 }, [parte('alvenaria', 'Revestimento', ALVENARIA), verde], { ajuste: { l: [60, 600] } }),
  p('poste', 'Poste de jardim', 'Jardim', { l: 20, p: 20, a: 90 }, [parte('metal', 'Acabamento', METAL)]),
]

export const buscarPeca = (slug: string) => pecas.find((p) => p.slug === slug)

/** Cores iniciais de cada parte: a primeira da paleta. */
export const coresPadrao = (peca: Peca) => Object.fromEntries(peca.partes.map((pt) => [pt.id, pt.cores[0].hex]))
