import type { ModelViewerElement } from '@google/model-viewer'
import { useRef, useState, type ReactNode } from 'react'
import { CardMovel } from '../components/CardMovel'
import { FotoMovel } from '../components/FotoMovel'
import { Camera, Conversa, Cubo, Escudo, Paleta, Planta, Sacola, Seta, Voltar } from '../components/Icones'
import { CenaRA, MockupAmbiente, MockupConversa, MockupLoja } from '../components/Mockups'
import { FormMarca } from '../components/Personalizar'
import { SeletorCores } from '../components/SeletorCores'
import { Visualizador3D } from '../components/Visualizador3D'
import { empresa } from '../config'
import { buscarMovel, categorias, foto, moveis, type Categoria } from '../data/moveis'
import { abrirPainel, personalizada, temNomeProprio, useMarca } from '../lib/marca'
import { hrefAmbiente, hrefMovel, hrefSecao } from '../router'

type Filtro = Categoria | 'Todos'

export function Inicio() {
  const [filtro, setFiltro] = useState<Filtro>('Todos')

  const irParaCategoria = (c: Categoria) => {
    setFiltro(c)
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Hero />
      <Beneficios />
      <Personalizar />
      <Categorias onEscolher={irParaCategoria} />
      <Catalogo filtro={filtro} setFiltro={setFiltro} />
      <MonteAmbiente />
      <Ambientes />
      <Sobre />
      <Experiencia />
      <RealidadeAumentada />
    </>
  )
}

const container = 'mx-auto max-w-[1400px] px-5 md:px-8'

function Titulo({ eyebrow, children, claro }: { eyebrow: string; children: ReactNode; claro?: boolean }) {
  return (
    <div>
      <p className={`eyebrow flex items-center gap-3 ${claro ? 'text-linho/60' : 'text-terracota'}`}>
        <span className={`h-px w-8 ${claro ? 'bg-linho/40' : 'bg-terracota'}`} />
        {eyebrow}
      </p>
      <h2 className="mt-5 text-[38px] leading-[1.02] sm:text-[48px] md:text-[64px]">{children}</h2>
    </div>
  )
}

function Hero() {
  const destaque = buscarMovel('mesa-jantar')!
  const [cor, setCor] = useState(0)
  const marca = useMarca()
  const proprio = temNomeProprio(marca)
  // Nomes longos ganham uma linha menor para não estourar o título.
  const tamanhoNome =
    marca.nome.length > 18
      ? 'text-[34px] sm:text-[52px] lg:text-[60px] xl:text-[68px]'
      : 'text-[46px] sm:text-[76px] lg:text-[88px] xl:text-[100px]'

  return (
    <section className="px-3 pt-2 md:px-5">
      <div className="relative mx-auto flex max-w-[1560px] overflow-hidden rounded-[28px] bg-estudio md:min-h-[min(calc(100svh-120px),840px)]">
        <div className="relative flex w-full flex-col justify-between gap-8 p-5 sm:gap-10 sm:p-7 md:p-12 xl:p-14">
          <CenaRA
            movel={destaque}
            cor={cor}
            medida="180 cm"
            className="order-1 -mx-5 h-[300px] sm:-mx-7 sm:h-[420px] md:absolute md:inset-y-0 md:right-0 md:order-none md:mx-0 md:h-auto md:w-[62%]"
          />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-estudio via-estudio/70 via-35% to-estudio/0 to-55% md:block" />

          <div className="relative max-w-2xl animar-surgir">
           
            {proprio ? (
              <h1 className="mt-2 text-[46px] leading-[0.95] sm:mt-8 sm:text-[76px] lg:text-[88px] xl:text-[100px]">
                <span className={`block break-words ${tamanhoNome}`}>{marca.nome}</span>
                na casa do <em className="text-terracota">cliente.</em>
              </h1>
            ) : (
              <h1 className="mt-2 text-[46px] leading-[0.95] sm:mt-8 sm:text-[76px] lg:text-[88px] xl:text-[100px]">
                Seu catálogo
                <br />
                na casa do <em className="text-terracota">cliente.</em>
              </h1>
            )}
            <p className="mt-5 max-w-md text-base leading-relaxed font-medium text-tinta/70 sm:mt-7 sm:text-[17px]">
              {proprio
                ? `Imagine o catálogo da loja ${marca.nome} em 3D e realidade aumentada: seu cliente aponta o celular, vê a peça em tamanho real na sala dele, monta o cômodo inteiro com os seus móveis e compra tudo com certeza.`
                : 'Transformamos os móveis da sua loja em 3D e realidade aumentada. Seu cliente aponta o celular, vê a peça em tamanho real na sala dele, monta o cômodo inteiro com os seus móveis e compra tudo com certeza.'}
            </p>
            <div className="mt-7 grid gap-3 sm:mt-9 sm:flex sm:flex-wrap">
              <a href={hrefSecao('catalogo')} className="botao group bg-musgo text-linho hover:bg-musgo-escuro">
                Testar a demonstração <Seta className="size-4 transition group-hover:translate-x-0.5" />
              </a>
              <a href={hrefSecao('contato')} className="botao border border-tinta/20 bg-linho/60 backdrop-blur hover:bg-linho">
                Quero na minha loja
              </a>
            </div>
            <button
              type="button"
              onClick={() => abrirPainel()}
              className="mt-5 inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-linho/70 py-2 pr-4 pl-2 text-left text-sm font-semibold backdrop-blur transition hover:bg-linho"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-terracota text-linho">
                <Paleta className="size-4" />
              </span>
              {personalizada(marca) ? 'Editar o nome e as cores' : 'Veja este site com o nome e as cores da sua loja'}
            </button>
          </div>

          <div className="relative order-2 -mt-24 flex items-end justify-between gap-6 md:order-none md:mt-0">
            <div className="hidden gap-10 md:flex">
              {[
                ['360°', 'visualização em 3D'],
                ['1:1', 'realidade aumentada em escala real'],
                ['0', 'aplicativos para baixar'],
              ].map(([n, t]) => (
                <div key={t}>
                  <p className="font-display text-4xl">{n}</p>
                  <p className="mt-1 text-xs font-semibold text-tinta/60">{t}</p>
                </div>
              ))}
            </div>

            <div className="ml-auto w-full max-w-[300px] rounded-2xl bg-linho/90 p-3 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.35)] backdrop-blur-md animar-surgir [animation-delay:250ms]">
              <a href={hrefMovel(destaque.slug)} className="flex items-center gap-3">
                <FotoMovel
                  imagem={destaque.imagem}
                  cor={destaque.cores[cor]}
                  original={cor === 0}
                  alt={destaque.nome}
                  largura={240}
                  enquadramento={destaque.enquadramento}
                  className="size-[72px] shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-terracota uppercase">Experimente agora</p>
                  <p className="mt-0.5 font-display text-[22px] leading-tight">{destaque.nome}</p>
                  <p className="text-xs font-semibold text-pedra">{destaque.cores[cor].nome}</p>
                </div>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-musgo text-linho">
                  <Seta className="size-4" />
                </span>
              </a>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-creme px-3 py-2.5">
                <span className="text-xs font-semibold text-pedra">Troque a cor</span>
                <SeletorCores cores={destaque.cores} selecionada={cor} onSelecionar={setCor} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Beneficios() {
  const itens = [
    { icone: <Cubo />, titulo: 'Sem aplicativo', texto: 'Abre direto no navegador do celular' },
    { icone: <Camera />, titulo: 'Tamanho real', texto: 'A peça aparece em escala 1:1 no ambiente' },
    { icone: <Paleta />, titulo: 'Todas as cores', texto: 'Tecidos e acabamentos trocados no 3D' },
    { icone: <Escudo />, titulo: 'Nós cuidamos de tudo', texto: 'Modelagem, publicação e suporte' },
  ]

  return (
    <section className={`${container} py-10 md:py-14`}>
      <div className="grid grid-cols-2 gap-3 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-4 lg:divide-x lg:divide-tinta/10">
        {itens.map((i) => (
          <div key={i.titulo} className="flex flex-col items-start gap-3 rounded-[20px] bg-creme/70 p-4 sm:flex-row sm:gap-4 sm:rounded-none sm:bg-transparent sm:p-0 lg:px-8 lg:first:pl-0">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-linho text-musgo sm:size-12 sm:bg-creme">{i.icone}</span>
            <div>
              <p className="font-bold">{i.titulo}</p>
              <p className="mt-0.5 text-sm text-pedra">{i.texto}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Personalizar() {
  const itens = [
    'O nome da sua loja no header, no catálogo e no rodapé',
    'Suas 4 cores em botões, faixas, selos e no fundo das peças',
    'Mockups da loja online e do WhatsApp com o seu nome',
    'Um link personalizado para mostrar ao seu time',
  ]

  return (
    <section id="personalizar" className="scroll-mt-20 px-3 py-6 md:px-5 md:py-10">
      <div className="mx-auto grid max-w-[1560px] grid-cols-[minmax(0,1fr)] items-center gap-10 overflow-hidden rounded-[28px] bg-musgo px-5 py-12 sm:gap-12 sm:px-6 sm:py-14 text-linho md:px-14 md:py-20 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-20">
        <div>
          <Titulo eyebrow="Personalize" claro>
            Veja o site com
            <br />a cara da <em className="text-destaque-claro">sua loja.</em>
          </Titulo>
          <p className="mt-6 max-w-md text-base leading-relaxed text-linho/75 sm:text-[17px]">
            Coloque o nome e as 4 cores da sua marca. O site inteiro muda na hora, para você imaginar o seu catálogo em
            3D funcionando de verdade.
          </p>
          <ul className="mt-8 space-y-3 sm:mt-9">
            {itens.map((i) => (
              <li key={i} className="flex items-center gap-3 text-sm font-semibold text-linho/90 sm:text-[15px]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-linho/10">
                  <span className="size-1.5 rounded-full bg-destaque-claro" />
                </span>
                {i}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[24px] bg-creme p-4 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.45)] sm:p-6 md:p-8">
          <FormMarca aoVer={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </div>
      </div>
    </section>
  )
}

const capaCategoria: Record<Categoria, string> = {
  Sofás: 'sofa-couro',
  Poltronas: 'poltrona-couro',
  Camas: 'cama-queen-madeira',
  Cadeiras: 'cadeira-escritorio',
  Mesas: 'mesa-jantar',
  Gaveteiros: 'gaveteiro-preto',
  Decoração: 'vaso-ficus',
}

/** Arrastar com o mouse para rolar na horizontal (no toque, a rolagem nativa já resolve). */
function useArrastar() {
  const ref = useRef<HTMLDivElement>(null)
  const arrasto = useRef({ x: 0, inicio: 0, ativo: false, moveu: false })
  const [arrastando, setArrastando] = useState(false)

  const soltar = () => {
    arrasto.current.ativo = false
    setArrastando(false)
  }

  return {
    ref,
    arrastando,
    rolar: (sentido: 1 | -1) => ref.current?.scrollBy({ left: sentido * ref.current.clientWidth * 0.8, behavior: 'smooth' }),
    eventos: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse' || !ref.current) return
        arrasto.current = { x: e.clientX, inicio: ref.current.scrollLeft, ativo: true, moveu: false }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const a = arrasto.current
        if (!a.ativo || !ref.current) return
        const dx = e.clientX - a.x
        if (!a.moveu && Math.abs(dx) > 6) {
          a.moveu = true
          setArrastando(true)
        }
        if (a.moveu) ref.current.scrollLeft = a.inicio - dx
      },
      onPointerUp: soltar,
      onPointerLeave: soltar,
      // Depois de arrastar, o clique que vem junto não abre a categoria.
      onClickCapture: (e: React.MouseEvent) => {
        if (!arrasto.current.moveu) return
        e.preventDefault()
        e.stopPropagation()
        arrasto.current.moveu = false
      },
    },
  }
}

function Categorias({ onEscolher }: { onEscolher: (c: Categoria) => void }) {
  const { ref, arrastando, rolar, eventos } = useArrastar()

  return (
    <section className={`${container} py-14 md:py-20`}>
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <Titulo eyebrow="Qualquer peça">
          Funciona com todo
          <br />
          o seu mix.
        </Titulo>
        <p className="max-w-sm text-pedra">
          Do sofá da sala ao vaso do canto: modelamos cada categoria da sua loja. Toque numa delas para ver o exemplo.
        </p>
      </div>

      <div className="mt-10 hidden justify-end gap-2 md:flex">
        {([-1, 1] as const).map((sentido) => (
          <button
            key={sentido}
            type="button"
            onClick={() => rolar(sentido)}
            aria-label={sentido < 0 ? 'Categorias anteriores' : 'Próximas categorias'}
            className="grid size-11 cursor-pointer place-items-center rounded-full border border-tinta/15 transition hover:border-tinta hover:bg-creme"
          >
            {sentido < 0 ? <Voltar className="size-4" /> : <Seta className="size-4" />}
          </button>
        ))}
      </div>

      <div
        ref={ref}
        {...eventos}
        className={`-mx-5 mt-8 flex gap-3 sm:gap-4 md:mt-5 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8 [&::-webkit-scrollbar]:hidden ${
          arrastando ? 'cursor-grabbing select-none' : 'cursor-grab snap-x snap-mandatory'
        }`}
      >
        {categorias.map((c) => {
          const capa = buscarMovel(capaCategoria[c])!
          const total = moveis.filter((m) => m.categoria === c).length
          return (
            <button
              key={c}
              type="button"
              onClick={() => onEscolher(c)}
              className="group relative w-[72%] shrink-0 bg-estudio snap-start overflow-hidden rounded-[20px] text-left sm:w-[42%] md:w-[30%] lg:w-[23%] xl:w-[19%]"
            >
              <img
                src={foto(capa.imagem, 700)}
                alt=""
                draggable={false}
                loading="lazy"
                className="aspect-[3/4] h-full w-full object-cover transition duration-700 group-hover:scale-105"
                style={{ objectPosition: capa.enquadramento }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-linho">
                <div>
                  <p className="font-display text-[28px] leading-none">{c}</p>
                  <p className="mt-1.5 text-xs font-semibold text-linho/75">
                    {total} {total === 1 ? 'peça' : 'peças'}
                  </p>
                </div>
                <span className="grid size-9 place-items-center rounded-full bg-linho/20 backdrop-blur transition group-hover:bg-linho group-hover:text-tinta">
                  <Seta className="size-4" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Catalogo({ filtro, setFiltro }: { filtro: Filtro; setFiltro: (f: Filtro) => void }) {
  const lista = filtro === 'Todos' ? moveis : moveis.filter((m) => m.categoria === filtro)
  const marca = useMarca()
  const proprio = temNomeProprio(marca)

  return (
    <section id="catalogo" className="scroll-mt-20 bg-creme py-14 md:py-28">
      <div className={container}>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <Titulo eyebrow={proprio ? `Catálogo ${marca.nome}` : 'Demonstração ao vivo'}>
            Experimente como seu cliente.
          </Titulo>
          <div className="flex gap-1 overflow-x-auto rounded-full bg-linho p-1 lg:shrink-0">
            {(['Todos', ...categorias] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFiltro(c)}
                className={`shrink-0 cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  filtro === c ? 'bg-musgo text-linho' : 'text-tinta/60 hover:text-tinta'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 max-w-lg text-pedra">
          {proprio ? `Este seria o catálogo da loja ${marca.nome}, com peças de exemplo` : 'Este é um catálogo de exemplo'},
          funcionando de verdade. Troque as cores, abra uma peça com o selo 3D · RA, gire em 360° e toque em “Ver no meu
          espaço”. Ou toque em “Ambiente” no card para montar um cômodo com as peças: é exatamente isso que o seu site
          vai ter.
        </p>

        <div className="mt-10 grid grid-flow-row-dense grid-cols-1 gap-x-6 gap-y-10 sm:mt-12 sm:gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((m) => {
            const largo = m.formato === 'largo'
            return (
              <div key={m.slug} className={`animar-surgir ${largo ? 'sm:col-span-2' : ''}`}>
                <CardMovel movel={m} largo={largo} />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function MonteAmbiente() {
  const passos = [
    {
      icone: <Planta />,
      titulo: 'Desenha o cômodo',
      texto: 'Formato, medidas, portas e pé-direito. Depois escolhe a cor das paredes e o piso.',
    },
    {
      icone: <Cubo />,
      titulo: 'Coloca as peças da loja',
      texto: 'Adiciona os móveis do catálogo na cor que quiser, arrasta, gira e vê tudo em 3D e em escala.',
    },
    {
      icone: <Sacola />,
      titulo: 'Compra o ambiente todo',
      texto: 'A lista sai pronta com cada peça e cor: vai direto para o carrinho ou para o seu vendedor.',
    },
  ]

  return (
    <section id="monte-seu-ambiente" className={`${container} scroll-mt-20 py-14 md:py-28`}>
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <Titulo eyebrow="Ambiente 3D">
          Ele monta a sala.
          <br />
          Você vende <em className="text-terracota">a sala toda.</em>
        </Titulo>
        <div className="max-w-md">
          <p className="text-[17px] leading-relaxed text-pedra">
            Além de ver cada peça em 3D e na câmera, seu cliente desenha o próprio cômodo, mobilia com os produtos da
            loja e leva o conjunto inteiro numa compra só.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={hrefAmbiente} className="botao group bg-musgo text-linho hover:bg-musgo-escuro">
              Montar um ambiente <Seta className="size-4 transition group-hover:translate-x-0.5" />
            </a>
            <a href={hrefSecao('contato')} className="botao border border-tinta/20 hover:bg-creme">
              Quero na minha loja
            </a>
          </div>
        </div>
      </div>

      <div className="mt-10 md:mt-12">
        <MockupAmbiente />
      </div>

      <ol className="mt-4 grid gap-4 md:grid-cols-3">
        {passos.map((p, i) => (
          <li key={p.titulo} className="rounded-[20px] bg-creme p-6 md:p-7">
            <div className="flex items-center justify-between">
              <span className="grid size-12 place-items-center rounded-xl bg-linho text-terracota">{p.icone}</span>
              <span className="font-display text-4xl text-tinta/15">0{i + 1}</span>
            </div>
            <p className="mt-6 text-lg font-bold">{p.titulo}</p>
            <p className="mt-1.5 leading-relaxed text-pedra">{p.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Ambientes() {
  const blocos = [
    {
      eyebrow: 'Loja online',
      titulo: 'Venda sem o cliente ir à loja.',
      texto: 'Na página do produto, o cliente vê a mesa na sala dele, no acabamento que quiser, e tira a dúvida que travava a compra.',
      visual: <MockupLoja movel={buscarMovel('mesa-jantar')!} />,
      movel: 'mesa-jantar',
      cta: 'Testar com a Mesa de Jantar',
      painel: 'bg-musgo text-linho',
    },
    {
      eyebrow: 'Showroom e WhatsApp',
      titulo: 'Seu vendedor com um link.',
      texto: 'Mande a peça pelo WhatsApp e o cliente abre em realidade aumentada de casa, sem baixar nada.',
      visual: <MockupConversa movel={buscarMovel('cadeira-escritorio')!} />,
      movel: 'cadeira-escritorio',
      cta: 'Testar com a Cadeira de Escritório',
      painel: 'bg-areia text-tinta',
    },
  ]

  return (
    <section id="ambientes" className={`${container} scroll-mt-20 space-y-4 py-14 md:py-28`}>
      <div className="mb-10 md:mb-12">
        <Titulo eyebrow="Para quem é">Onde o 3D vende por você.</Titulo>
      </div>
      {blocos.map((b, i) => {
        const claro = b.painel.includes('text-linho')
        return (
          <div key={b.titulo} className="grid overflow-hidden rounded-[28px] md:grid-cols-[1.35fr_1fr]">
            <div className={`relative md:min-h-[520px] ${i % 2 ? 'md:order-2' : ''}`}>{b.visual}</div>
            <div className={`flex flex-col justify-between gap-6 p-6 sm:gap-10 sm:p-8 md:p-12 ${b.painel}`}>
              <p className={`eyebrow ${claro ? 'text-linho/60' : 'text-terracota'}`}>
                0{i + 1} · {b.eyebrow}
              </p>
              <div>
                <h3 className="text-[34px] leading-[1.02] sm:text-[40px] md:text-[52px]">{b.titulo}</h3>
                <p className={`mt-5 max-w-sm leading-relaxed ${claro ? 'text-linho/75' : 'text-pedra'}`}>{b.texto}</p>
                <a
                  href={hrefMovel(b.movel)}
                  className={`botao group mt-8 ${claro ? 'bg-linho text-musgo hover:bg-creme' : 'bg-musgo text-linho hover:bg-musgo-escuro'}`}
                >
                  {b.cta} <Seta className="size-4 transition group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function Sobre() {
  const pilares = [
    { n: '01', titulo: 'Mais confiança', texto: 'O cliente vê medida, cor e proporção no próprio ambiente antes de pagar.' },
    { n: '02', titulo: 'Mais conversão', texto: 'Menos “vou pensar”: a dúvida sobre se cabe ou combina se resolve na hora.' },
    { n: '03', titulo: 'Menos devolução', texto: 'Quem testou em casa compra a peça certa, no tamanho certo.' },
    { n: '04', titulo: 'Ticket maior', texto: 'Quem monta o cômodo leva o sofá, a poltrona e a mesinha juntos.' },
  ]

  return (
    <section id="sobre" className="scroll-mt-20 bg-musgo text-linho">
      <div className={`${container} py-14 md:py-28`}>
        <p className="eyebrow text-center text-linho/55">Por que a {empresa.nome}</p>
        <h2 className="mx-auto mt-6 max-w-4xl text-center text-[36px] leading-[1.05] sm:text-[48px] md:text-[68px]">
          Menos dúvida no carrinho, <em className="text-destaque-claro">mais móvel vendido.</em>
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-linho/10 md:mt-16 lg:grid-cols-4">
          {pilares.map((p) => (
            <div key={p.n} className="bg-musgo p-5 sm:p-8 md:p-10">
              <p className="font-display text-4xl text-linho/25 sm:text-5xl">{p.n}</p>
              <p className="mt-5 text-base font-bold sm:mt-8 sm:text-xl">{p.titulo}</p>
              <p className="mt-2 text-sm leading-relaxed text-linho/65 sm:text-[15px]">{p.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Experiencia() {
  const peca = buscarMovel('gaveteiro-preto')!
  const viewer = useRef<ModelViewerElement>(null)

  return (
    <section className={`${container} py-14 md:py-28`}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative aspect-square overflow-hidden rounded-[28px] sm:aspect-[4/3]">
          <Visualizador3D movel={peca} cor={0} refViewer={viewer} />
          <div className="pointer-events-none absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-linho px-4 py-2 text-xs font-bold shadow-lg">
            <span className="size-2 animate-pulse rounded-full bg-terracota" /> Modelo real · toque nas gavetas
          </div>
          <div className="absolute right-4 bottom-4 flex items-center gap-3 rounded-2xl bg-linho/90 p-2 shadow-xl backdrop-blur-md sm:right-5 sm:bottom-5 sm:p-3">
            <span className="hidden items-center gap-2 rounded-xl bg-creme px-3 py-2 text-xs font-bold sm:flex">
              <Cubo className="size-4" /> Arraste: 360°
            </span>
            <a
              href={hrefMovel(peca.slug)}
              className="flex items-center gap-2 rounded-xl bg-musgo px-4 py-2 text-xs font-bold text-linho transition hover:bg-musgo-escuro"
            >
              <Camera className="size-4" /> Ver no meu espaço
            </a>
          </div>
        </div>

        <div>
          <Titulo eyebrow="O que você recebe">
            Do móvel físico
            <br />
            ao 3D no seu site.
          </Titulo>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-pedra">
            Criamos o modelo 3D de cada peça com as cores e acabamentos reais e entregamos tudo pronto para o seu site,
            loja virtual ou WhatsApp.
          </p>
          <div className="mt-10 space-y-3">
            {[
              { icone: <Cubo />, titulo: 'Modelagem 3D fiel', texto: 'Cada ângulo, textura, cor e parte móvel da peça.' },
              { icone: <Camera />, titulo: 'Realidade aumentada', texto: 'O cliente posiciona o móvel na casa dele pela câmera.' },
              { icone: <Planta />, titulo: 'Ambiente 3D', texto: 'Ele monta o cômodo com as suas peças e compra tudo junto.' },
              { icone: <Conversa />, titulo: 'Implantação e suporte', texto: 'Publicamos no seu site e acompanhamos de perto.' },
            ].map((i) => (
              <div key={i.titulo} className="flex items-center gap-4 rounded-2xl border border-tinta/10 p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-creme text-terracota">{i.icone}</span>
                <div>
                  <p className="font-bold">{i.titulo}</p>
                  <p className="text-sm text-pedra">{i.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RealidadeAumentada() {
  const peca = buscarMovel('poltrona-couro')!
  const [cor, setCor] = useState(0)
  const marca = useMarca()

  const passos = [
    { titulo: 'Envie suas peças', texto: 'Fotos, medidas e acabamentos dos móveis que você quer no 3D.' },
    { titulo: 'Nós modelamos', texto: 'Criamos cada peça em 3D, em escala 1:1 e com todas as cores.' },
    { titulo: 'Seu cliente testa em casa', texto: 'Publicamos no seu catálogo: ele vê o móvel na casa dele ou monta o cômodo inteiro no 3D.' },
  ]

  return (
    <section id="realidade-aumentada" className="scroll-mt-20 px-3 py-3 md:px-5 md:py-5">
      <div className="relative mx-auto grid max-w-[1560px] items-center gap-10 overflow-hidden rounded-[28px] bg-creme px-5 py-12 sm:gap-14 sm:px-6 sm:py-16 md:px-14 md:py-20 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow flex items-center gap-3 text-terracota">
              <span className="h-px w-8 bg-terracota" />
              Como funciona
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-musgo px-3 py-1 text-[11px] font-bold text-linho">
              <span className="size-1.5 animate-pulse rounded-full bg-destaque-claro" /> Em 3 passos
            </span>
          </div>
          <h2 className="mt-5 text-[38px] leading-[1.02] sm:text-[48px] md:text-[68px]">
            Seu cliente testa
            <br />
            antes de <em className="text-terracota">comprar.</em>
          </h2>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-pedra">
            Você manda as peças, a gente cuida do resto. Seu catálogo ganha 3D e realidade aumentada, e o cliente vê
            cada móvel em tamanho real, exatamente onde ele vai ficar.
          </p>

          <ol className="mt-10 space-y-3">
            {passos.map((p, i) => (
              <li key={p.titulo} className="flex items-start gap-4 rounded-2xl bg-linho p-4 md:p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-musgo font-display text-lg text-linho">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold">{p.titulo}</p>
                  <p className="mt-0.5 text-sm text-pedra">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href={hrefMovel('poltrona-couro')} className="botao group bg-musgo text-linho hover:bg-musgo-escuro">
              Testar com a Poltrona de Couro <Seta className="size-4 transition group-hover:translate-x-0.5" />
            </a>
            <a href={hrefSecao('contato')} className="text-sm font-semibold text-pedra underline-offset-4 hover:text-tinta hover:underline">
              Ou agende uma demonstração
            </a>
          </div>
        </div>

        <div className="relative flex justify-center py-4">
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-areia md:size-[520px]"
          />

          <div className="absolute top-[18%] left-0 z-10 hidden items-center gap-3 rounded-2xl bg-linho p-3 pr-5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.3)] xl:flex">
            <span className="grid size-10 place-items-center rounded-xl bg-creme text-terracota">
              <Camera className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Tamanho real</p>
              <p className="text-xs text-pedra">Escala 1:1 no seu espaço</p>
            </div>
          </div>
          <div className="absolute top-[32%] right-0 z-10 hidden items-center gap-3 rounded-2xl bg-linho p-3 pr-5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.3)] xl:flex">
            <span className="grid size-10 place-items-center rounded-xl bg-creme text-terracota">
              <Paleta className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{peca.cores.length} cores</p>
              <p className="text-xs text-pedra">Troque com um toque</p>
            </div>
          </div>

          <div className="relative w-[290px] rounded-[48px] bg-tinta p-[10px] shadow-[0_50px_80px_-30px_rgba(0,0,0,0.45)] md:w-[320px]">
            <div
              className="relative aspect-[9/19] overflow-hidden rounded-[38px]"
              style={{ background: 'linear-gradient(#dfd5d5 0 56%, #cfb09d 60% 100%)' }}
            >
              <div className="absolute inset-x-0 top-[42%] -translate-y-1/2 [mask-image:linear-gradient(transparent,black_14%,black_86%,transparent)]">
                <FotoMovel
                  imagem={peca.imagem}
                  cor={peca.cores[cor]}
                  original={cor === 0}
                  alt={`${peca.nome} na cor ${peca.cores[cor].nome}, visto em realidade aumentada`}
                  largura={700}
                  className="aspect-[4/5] w-full"
                  fundo={false}
                />
              </div>

              <div className="absolute inset-x-[6%] top-[27%] bottom-[37%] rounded-xl border-2 border-dashed border-white/90">
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-tinta/80 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-linho backdrop-blur">
                  ← 90 cm →
                </span>
                {['-top-1.5 -left-1.5', '-top-1.5 -right-1.5', '-bottom-1.5 -left-1.5', '-bottom-1.5 -right-1.5'].map((pos) => (
                  <span key={pos} className={`absolute size-3 rounded-full border-2 border-white bg-terracota ${pos}`} />
                ))}
              </div>

              <div className="absolute inset-x-0 top-0 flex justify-center pt-2.5">
                <span className="h-6 w-24 rounded-full bg-tinta" />
              </div>
              <div className="absolute inset-x-3 top-12 flex items-center justify-between rounded-2xl bg-linho/85 px-3.5 py-2.5 backdrop-blur-md">
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-terracota uppercase">{temNomeProprio(marca) ? `${marca.nome} · RA` : 'Ao vivo · RA'}</p>
                  <p className="font-display text-lg leading-tight">{peca.nome}</p>
                </div>
                <span className="rounded-full bg-musgo px-2.5 py-1 text-[10px] font-bold text-linho">1:1</span>
              </div>

              <div className="absolute inset-x-3 bottom-3 rounded-[26px] bg-linho/90 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">Cor</p>
                  <p className="text-xs font-semibold text-pedra">{peca.cores[cor].nome}</p>
                </div>
                <div className="mt-3 [&_button]:size-9 [&>div]:gap-2">
                  <SeletorCores cores={peca.cores} selecionada={cor} onSelecionar={setCor} tamanho="g" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-full bg-creme">
                    <Cubo className="size-4" />
                  </span>
                  <span className="grid size-14 place-items-center rounded-full border-[3px] border-musgo">
                    <span className="size-10 rounded-full bg-musgo" />
                  </span>
                  <span className="grid size-10 place-items-center rounded-full bg-creme">
                    <Camera className="size-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

