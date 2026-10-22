export type Categoria = 'Sofás' | 'Poltronas' | 'Camas' | 'Cadeiras' | 'Mesas' | 'Gaveteiros' | 'Decoração'

export type Cor = {
  nome: string
  hex: string
  /** Foto real do móvel nesta cor. Sem ela, a foto principal recebe um tom aproximado. */
  imagem?: string
  /** Cor aplicada no modelo 3D, quando precisa ser diferente da bolinha (ex.: tingir madeira). */
  fator?: string
  /** Segunda cor da bolinha, para opções que combinam duas cores (ex.: roupa de cama). */
  hex2?: string
  /** Cor de cada material do modelo 3D, nas opções de `complemento` (ex.: edredom, manta e almofadas). */
  materiais?: Record<string, string>
}

export type Modelo3D = {
  /** Arquivo .glb em src/assets/moveis. O .usdz do iPhone é gerado automaticamente. */
  src: string
  /** Nomes dos materiais do .glb que mudam de cor. */
  materiais: string[]
  /** 'tingir' multiplica a cor sobre a textura (madeira); 'trocar' substitui a cor e mantém o relevo (couro, metal). */
  modo: 'tingir' | 'trocar'
  /** Partes que abrem e fecham ao tocar nelas no 3D (gavetas, assentos retráteis, encostos reclináveis). */
  gavetas?: Gaveta[]
  /** Texto da dica sobre o 3D, quando as partes móveis não são gavetas. */
  dica?: string
  /** O tampo serve de apoio: no ambiente, decorações arrastadas para cima dele ficam em cima dele. */
  apoio?: boolean
}

export type Gaveta = {
  /** Nome do nó da gaveta no .glb. */
  no: string
  /** Quanto a gaveta abre, em metros, para a frente (+Z). Com `giro`, ângulo em radianos em torno do eixo X. */
  curso: number
  /** A parte gira em vez de deslizar (encosto reclinável). */
  giro?: boolean
  /** Nó da corrediça telescópica, que acompanha a gaveta pela metade do curso. */
  corredica?: string
}

export type Movel = {
  slug: string
  nome: string
  categoria: Categoria
  linha: string
  resumo: string
  descricao: string
  imagem: string
  galeria: string[]
  /** 'largo' ocupa duas colunas no catálogo (sofás, camas). */
  formato?: 'largo'
  /** object-position da foto no card, para enquadrar o móvel. */
  enquadramento?: string
  cores: Cor[]
  /** Segunda escolha, independente da cor da peça (ex.: roupa de cama). Cada opção pinta os seus `materiais` no 3D. */
  complemento?: { rotulo: string; opcoes: Cor[] }
  dimensoes: string
  materiais: string[]
  /** Com modelo, a peça ganha visualização 3D e "Ver no meu espaço" (RA) em tamanho real. */
  modelo?: Modelo3D
}

/** Aceita um id do Unsplash ou uma URL de imagem local. */
export const foto = (id: string, largura = 1200) =>
  id.includes('/') ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${largura}&q=80`

const arquivos = import.meta.glob<string>('../assets/moveis/*.{glb,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

/** URL de um arquivo de src/assets/moveis, ex.: arquivo('poltrona-couro.glb'). */
const arquivo = (nome: string) => {
  const url = arquivos[`../assets/moveis/${nome}`]
  if (!url) throw new Error(`Arquivo não encontrado em src/assets/moveis: ${nome}`)
  return url
}

/** Renders do modelo 3D em cada cor: <slug>-<índice da cor>.webp */
const renders = (slug: string, cores: Omit<Cor, 'imagem'>[]): Cor[] =>
  cores.map((c, i) => ({ ...c, imagem: arquivo(`${slug}-${i}.webp`) }))

export const categorias: Categoria[] = ['Sofás', 'Poltronas', 'Camas', 'Cadeiras', 'Mesas', 'Gaveteiros', 'Decoração']

export const moveis: Movel[] = [
  {
    slug: 'sofa-couro',
    nome: 'Sofá de Couro 2 Lugares',
    categoria: 'Sofás',
    linha: 'Clássico em couro',
    resumo: 'Braços retos, almofadas soltas e pés em madeira.',
    descricao:
      'Linhas retas e conforto de sobra: braços largos com costuras aparentes, almofadas de assento e encosto soltas e revestimento em couro macio que ganha marcas de uso com o tempo. Os pés cônicos em madeira dão leveza ao conjunto. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('sofa-couro-0.webp'),
    galeria: [],
    formato: 'largo',
    cores: renders('sofa-couro', [
      { nome: 'Preto', hex: '#232528' },
      { nome: 'Café', hex: '#3f2a20' },
      { nome: 'Conhaque', hex: '#6e3520' },
      { nome: 'Caramelo', hex: '#a8622f' },
      { nome: 'Grafite', hex: '#4a4a4c' },
    ]),
    dimensoes: '186 L × 93 P × 83 A cm (assento a 44 cm)',
    materiais: ['Couro', 'Estrutura em madeira', 'Pés em madeira maciça'],
    modelo: { src: arquivo('sofa-couro.glb'), materiais: ['Couro'], modo: 'trocar' },
  },
  {
    slug: 'poltrona-couro',
    nome: 'Poltrona de Couro',
    categoria: 'Poltronas',
    linha: 'Clássico em couro',
    resumo: 'Volume generoso, braços largos e pés em preto acetinado.',
    descricao:
      'Desenho geométrico com braços largos e assento profundo, revestida em couro com vivos aparentes. Os pés em preto acetinado deixam a peça leve e contemporânea. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('poltrona-couro-0.webp'),
    galeria: [],
    cores: renders('poltrona-couro', [
      { nome: 'Caramelo', hex: '#a8622f' },
      { nome: 'Conhaque', hex: '#6e3520' },
      { nome: 'Café', hex: '#3f2a20' },
      { nome: 'Off-white', hex: '#e8dfd0' },
      { nome: 'Verde Musgo', hex: '#34483a' },
    ]),
    dimensoes: '90 L × 75 P × 70 A cm',
    materiais: ['Couro', 'Estrutura em madeira', 'Pés em preto acetinado'],
    modelo: { src: arquivo('poltrona-couro.glb'), materiais: ['Couro caramelo'], modo: 'trocar' },
  },
  {
    slug: 'cama-queen-madeira',
    nome: 'Cama Queen Palito',
    categoria: 'Camas',
    linha: 'Madeira maciça',
    resumo: 'Cabeceira de palitos, pés roliços e estrutura em madeira maciça finger.',
    descricao:
      'Leve e acolhedora, com cabeceira de palitos torneados, travessa de pontas arredondadas e pés roliços. A estrutura é em madeira maciça finger com pés em pinus maciço, estrado de ripas com viga central e acabamento fosco em tom nogueira. Para colchão Queen 158 × 198 cm (colchão e roupa de cama não inclusos). Veja em 3D e coloque no seu quarto em tamanho real.',
    imagem: arquivo('cama-queen-madeira-0.webp'),
    galeria: [],
    formato: 'largo',
    // A textura da madeira é a natural da Mesinha; o fator dá o tom (Nogueira = o do .glb).
    cores: renders('cama-queen-madeira', [
      { nome: 'Nogueira', hex: '#7a4a2e', fator: '#aab5e5' },
      { nome: 'Café', hex: '#4a3226', fator: '#797c95' },
      { nome: 'Ebanizado', hex: '#2e2724', fator: '#4d4c52' },
    ]),
    // Cores iguais às de COMBOS em modelos-3d/gen_cama_queen.py.
    complemento: {
      rotulo: 'Roupa de cama',
      opcoes: [
        {
          nome: 'Branco e Verde',
          hex: '#ecebe6',
          hex2: '#7f8c62',
          materiais: { Edredom: '#ecebe6', Manta: '#7f8c62', Travesseiro: '#ece8df', Almofada: '#e6e4dc' },
        },
        {
          nome: 'Cinza e Rosa',
          hex: '#b4b4b1',
          hex2: '#cf9a94',
          materiais: { Edredom: '#b4b4b1', Manta: '#cf9a94', Travesseiro: '#e9e6e1', Almofada: '#ddb5ae' },
        },
        {
          nome: 'Areia e Terracota',
          hex: '#dccfb9',
          hex2: '#ad5f3d',
          materiais: { Edredom: '#dccfb9', Manta: '#ad5f3d', Travesseiro: '#efe8db', Almofada: '#cfa385' },
        },
      ],
    },
    dimensoes: '173 L × 210 C × 94 A cm (lateral a 38 cm do chão) · 40 kg',
    materiais: ['Madeira maciça finger', 'Pés em pinus maciço', 'Cabeceira e estrado em madeira', 'Acabamento fosco'],
    modelo: { src: arquivo('cama-queen-madeira.glb'), materiais: ['Madeira'], modo: 'tingir' },
  },
  {
    slug: 'mesa-jantar',
    nome: 'Mesa de Jantar Tábua',
    categoria: 'Mesas',
    linha: 'Madeira maciça',
    resumo: 'Tampo de 4 cm em tábuas coladas e pés afunilados. Seis lugares.',
    descricao:
      'Feita para reunir: tampo maciço de 4 cm formado por quatro tábuas coladas, com o desenho natural dos veios à mostra, saia recuada e pés quadrados afunilados. Acomoda seis pessoas com folga e recebe acabamento acetinado que protege sem esconder a madeira. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('mesa-jantar-0.webp'),
    galeria: [],
    formato: 'largo',
    cores: renders('mesa-jantar', [
      { nome: 'Natural', hex: '#b8743a' },
      { nome: 'Mel', hex: '#a5653a', fator: '#c8bc90' },
      { nome: 'Nogueira', hex: '#6b4630', fator: '#9a7462' },
      { nome: 'Ebanizado', hex: '#2e2724', fator: '#4a4440' },
    ]),
    dimensoes: '180 C × 90 L × 78 A cm (6 lugares)',
    materiais: ['Madeira maciça', 'Tampo de 4 cm', 'Verniz acetinado'],
    modelo: { src: arquivo('mesa-jantar.glb'), materiais: ['Madeira tampo', 'Madeira estrutura'], modo: 'tingir', apoio: true },
  },
  {
    slug: 'mesinha-madeira',
    nome: 'Mesinha Redonda',
    categoria: 'Mesas',
    linha: 'Madeira aparente',
    resumo: 'Tampo redondo e pernas retas unidas por cavilhas.',
    descricao:
      'Pequena e versátil, funciona como mesa lateral, apoio de leitura ou mesa de canto. Tampo redondo com borda suave e pernas retas fixadas com cavilhas em nogueira escura. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('mesinha-madeira-0.webp'),
    galeria: [],
    cores: renders('mesinha-madeira', [
      { nome: 'Natural', hex: '#b8743a' },
      { nome: 'Nogueira', hex: '#6b4630', fator: '#9a7462' },
      { nome: 'Ebanizado', hex: '#2e2724', fator: '#4a4440' },
    ]),
    dimensoes: 'Ø 55 × 60 A cm',
    materiais: ['Madeira maciça', 'Cavilhas em nogueira'],
    modelo: { src: arquivo('mesinha-madeira.glb'), materiais: ['Madeira tampo', 'Madeira estrutura'], modo: 'tingir', apoio: true },
  },
  {
    slug: 'gaveteiro-preto',
    nome: 'Gaveteiro 4 Gavetas',
    categoria: 'Gaveteiros',
    linha: 'Home office',
    resumo: 'Quatro gavetas com corrediças telescópicas e puxadores em alumínio.',
    descricao:
      'Compacto e prático para o home office, o quarto ou ao lado da mesa de trabalho. Quatro gavetas amplas com corrediças telescópicas metálicas, puxadores em alça de alumínio escovado e acabamento fosco que não marca. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('gaveteiro-preto-0.webp'),
    galeria: [],
    cores: renders('gaveteiro-preto', [{ nome: 'Preto', hex: '#222222' }]),
    dimensoes: '41,5 L × 41,5 P × 64 A cm (gaveta aberta: +26 cm)',
    materiais: ['MDP com acabamento fosco', 'Corrediças telescópicas metálicas', 'Puxadores em alumínio'],
    modelo: {
      src: arquivo('gaveteiro-preto.glb'),
      materiais: ['preto_fosco', 'preto_interno'],
      modo: 'trocar',
      apoio: true,
      gavetas: [1, 2, 3, 4].map((i) => ({ no: `Gaveta_${i}`, curso: 0.26, corredica: `Corredica_Intermediaria_${i}` })),
    },
  },
  {
    slug: 'trofeu-horsepower',
    nome: 'Troféu Horsepower',
    categoria: 'Decoração',
    linha: 'Peça de coleção',
    resumo: 'Escultura metálica sobre pedestal em resina texturizada.',
    descricao:
      'Uma escultura de personalidade forte para estantes, aparadores e escritórios. Figura em acabamento metálico sobre pedestal em resina texturizada, com placa impressa e moldura dourada. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('trofeu-horsepower-0.webp'),
    galeria: [],
    cores: renders('trofeu-horsepower', [
      { nome: 'Bronze', hex: '#8a5a32' },
      { nome: 'Dourado', hex: '#d4a54a' },
      { nome: 'Prata', hex: '#c4c4c4' },
      { nome: 'Grafite', hex: '#3d3d3d' },
    ]),
    dimensoes: '18 L × 15 P × 45 A cm',
    materiais: ['Resina', 'Acabamento metálico', 'Moldura dourada'],
    modelo: { src: arquivo('trofeu-horsepower.glb'), materiais: ['BronzeFoto', 'Bronze'], modo: 'trocar' },
  },
  {
    slug: 'cadeira-escritorio',
    nome: 'Cadeira de Escritório',
    categoria: 'Cadeiras',
    linha: 'Home office',
    resumo: 'Encosto em tela, assento estofado e braços reguláveis.',
    descricao:
      'Feita para o dia a dia de trabalho, tem encosto em tela respirável com apoio lombar, assento estofado em couro sintético e braços com regulagem de altura. Pistão a gás e base giratória com rodízios duplos. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('cadeira-escritorio-0.webp'),
    galeria: [],
    cores: renders('cadeira-escritorio', [
      { nome: 'Preto', hex: '#222222' },
      { nome: 'Grafite', hex: '#4a4a4a' },
      { nome: 'Azul Marinho', hex: '#26324a' },
      { nome: 'Vinho', hex: '#6b2430' },
    ]),
    dimensoes: '55 L × 71 P × 84 A cm (assento a 45 cm)',
    materiais: ['Tela mesh', 'Couro sintético', 'Base em nylon com rodízios'],
    modelo: { src: arquivo('cadeira-escritorio.glb'), materiais: ['PU_Couro_Preto'], modo: 'trocar' },
  },
  {
    slug: 'vaso-ficus',
    nome: 'Vaso com Ficus',
    categoria: 'Decoração',
    linha: 'Verde em casa',
    resumo: 'Ficus elastica em vaso cônico com cobertura de casca de pinus.',
    descricao:
      'Folhas grandes e brilhantes que trazem vida para salas, halls e escritórios. Ficus elastica com vários caules em vaso cônico de acabamento fosco, finalizado com casca de pinus e pedriscos. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('vaso-ficus-0.webp'),
    galeria: [],
    cores: renders('vaso-ficus', [
      { nome: 'Preto', hex: '#222222' },
      { nome: 'Off-white', hex: '#efece6' },
      { nome: 'Terracota', hex: '#b5643e' },
      { nome: 'Cimento', hex: '#8e8b86' },
    ]),
    dimensoes: 'Vaso Ø 38 (topo) / Ø 20 (base) × 48 A cm · Altura total 125 cm',
    materiais: ['Vaso em polietileno fosco', 'Ficus elastica', 'Casca de pinus'],
    modelo: { src: arquivo('vaso-ficus.glb'), materiais: ['Vaso_Preto_Fosco'], modo: 'trocar' },
  },
  {
    slug: 'abajur-madeira',
    nome: 'Abajur de Madeira Torneada',
    categoria: 'Decoração',
    linha: 'Luz aconchegante',
    resumo: 'Base em madeira torneada e cúpula cônica. Acompanha lâmpada.',
    descricao:
      'Clássico para criados-mudos, aparadores e mesas de canto. Base em madeira torneada, com anéis e balaústre, no mesmo acabamento da Mesinha Redonda, e cúpula cônica em polipropileno com textura de linho, que espalha uma luz suave e quente. Bivolt, com fio branco de 1,20 m e lâmpada de brinde. Veja em 3D e coloque no seu espaço em tamanho real.',
    imagem: arquivo('abajur-madeira-0.webp'),
    galeria: [],
    // Mesma madeira e mesmos tons da Mesinha Redonda.
    cores: renders('abajur-madeira', [
      { nome: 'Natural', hex: '#b8743a' },
      { nome: 'Nogueira', hex: '#6b4630', fator: '#9a7462' },
      { nome: 'Ebanizado', hex: '#2e2724', fator: '#4a4440' },
    ]),
    // Cores iguais às de CUPULAS em modelos-3d/gen_abajur.py (a textura da cúpula é neutra clara).
    complemento: {
      rotulo: 'Cúpula',
      opcoes: [
        { nome: 'Bege', hex: '#dad2c2', materiais: { Cupula: '#dad2c2' } },
        { nome: 'Branca', hex: '#f1efea', materiais: { Cupula: '#f1efea' } },
        { nome: 'Cinza', hex: '#a9a7a2', materiais: { Cupula: '#a9a7a2' } },
        { nome: 'Preta', hex: '#2f2e2c', materiais: { Cupula: '#2f2e2c' } },
      ],
    },
    dimensoes: 'Altura 35 cm · Cúpula Ø 22 (embaixo) / Ø 9,5 (em cima) × 12 A cm · Base Ø 12,5 cm',
    materiais: ['Base em pinus torneado', 'Cúpula em polipropileno', 'Bivolt, fio de 1,20 m', 'Lâmpada E27 inclusa'],
    modelo: { src: arquivo('abajur-madeira.glb'), materiais: ['Madeira'], modo: 'tingir' },
  },
]

export const buscarMovel = (slug: string) => moveis.find((m) => m.slug === slug)
