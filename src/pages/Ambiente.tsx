import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorPlanta } from '../components/EditorPlanta'
import {
  Alvo,
  Camera,
  Check,
  Cubo,
  Desfazer,
  Duplicar,
  Fechar,
  Girar,
  GirarAnti,
  Janela,
  Lixeira,
  Mais,
  Menos,
  Mover,
  Olho,
  Paleta,
  Pessoa,
  Planta as IconePlanta,
  Porta,
  Seta,
  Voltar,
} from '../components/Icones'
import { ProvadorRA } from '../components/ProvadorRA'
import { SeletorCores } from '../components/SeletorCores'
import { ambientesProntos, buscarPronto, type AmbientePronto } from '../data/ambientesProntos'
import { buscarMovel, moveis, type Movel } from '../data/moveis'
import { buscarPeca, categoriasPeca, coresPadrao, pecas, type CategoriaPeca, type Peca } from '../data/pecas'
import {
  ALTURA_PORTA,
  alturaDaParede,
  area,
  AREA_USO,
  acabamentoPadrao,
  adicionarItem,
  adicionarPeca,
  atualizarItem,
  atualizarItens,
  caixa,
  carregarAmbiente,
  comecarDoZero,
  coresEsquadria,
  coresParede,
  coresPorta,
  coresSituacao,
  corDaParede,
  definirAberturas,
  definirAcabamento,
  definirPlanta,
  desfazer,
  duplicarItem,
  escolherFormato,
  formatos,
  geometria,
  irPara,
  JANELA_PADRAO,
  LARGURA_PORTA,
  lerAmbiente,
  limitarPorta,
  marcarDesfazer,
  metros,
  novoIdPorta,
  papeis,
  papelDaParede,
  PE_DIREITO,
  pisos,
  podeDesfazer,
  PORTA_VIDRO,
  removerItem,
  rotulosSituacao,
  temConteudo,
  useAmbiente,
  type Acabamento,
  type Ambiente as Estado,
  type Geometria,
  type Item,
  type Janela as TipoJanela,
  type OpcaoCor,
  type Planta,
  type Porta as TipoPorta,
  type Situacao,
  type TipoPapel,
} from '../lib/ambiente'
import { CenaAmbiente, type Modo } from '../lib/cena3d'
import { miniaturaPeca } from '../lib/pecas3d'
import { miniaturaPapel } from '../lib/texturasParede'
import { miniaturaPiso } from '../lib/texturasPiso'
import { totem } from '../lib/totem'
import { hrefAmbiente } from '../router'

// No celular deitado, o mínimo cede para a cena caber na tela.
const altura = 'h-[62svh] min-h-[min(440px,85svh)] lg:h-[calc(100svh-150px)] lg:min-h-[620px] totem-v:h-[46svh] totem-v:min-h-0 totem-h:h-[calc(100svh-140px)] totem-h:min-h-0'

export function Ambiente({ pronto, foto }: { pronto?: string; foto?: boolean }) {
  const ambiente = useAmbiente()
  const [confirmar, setConfirmar] = useState<AmbientePronto | null>(null)

  // Link direto para um ambiente pronto (#/ambiente/sala): abre, pedindo confirmação se houver trabalho feito.
  useEffect(() => {
    const p = pronto && !foto ? buscarPronto(pronto) : undefined
    if (!p) return
    if (temConteudo(lerAmbiente()) && lerAmbiente().nome !== p.nome) setConfirmar(p)
    else abrirPronto(p)
    history.replaceState(null, '', hrefAmbiente)
  }, [pronto, foto])

  if (foto && pronto) return <FotoPronto id={pronto} casinha={location.hash.endsWith('/cima')} />

  const escolher = (p: AmbientePronto) => (temConteudo(ambiente) ? setConfirmar(p) : abrirPronto(p))

  return (
    <>
      {ambiente.etapa === 'galeria' ? <Galeria ambiente={ambiente} onEscolher={escolher} /> : <Editor ambiente={ambiente} />}
      {confirmar && (
        <Confirmacao
          titulo={`Abrir “${confirmar.nome}”?`}
          texto="O ambiente que você está montando será substituído por este."
          acao="Abrir ambiente"
          onCancelar={() => setConfirmar(null)}
          onConfirmar={() => {
            abrirPronto(confirmar)
            setConfirmar(null)
          }}
        />
      )}
    </>
  )
}

/** Ambiente pronto abre na vista de dentro, como quem entra nele; o resto começa de cima. */
let modoInicial: Modo = '3d'

const abrirPronto = (p: AmbientePronto) => {
  modoInicial = p.planta.fachada ? '3d' : 'dentro'
  selecionar(null)
  definirPainel({ aba: 'itens', parede: 0 })
  carregarAmbiente(p)
  window.scrollTo({ top: 0 })
}

type Medidas = { area: number; largura: number; profundidade: number }

const formatarArea = (m2: number) => m2.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const contarItens = (n: number) => `${n} ${n === 1 ? 'item no ambiente' : 'itens no ambiente'}`

// --- Galeria de ambientes prontos ----------------------------------------------------

type Grupo = 'todos' | 'social' | 'intimo' | 'servico'
const grupos: { id: Grupo; rotulo: string; ids?: string[] }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'social', rotulo: 'Social', ids: ['fachada', 'sala', 'apartamento', 'area-gourmet'] },
  { id: 'intimo', rotulo: 'Íntimo', ids: ['quarto', 'closet', 'banheiro'] },
  { id: 'servico', rotulo: 'Serviço', ids: ['cozinha', 'lavanderia', 'escritorio'] },
]

function Galeria({ ambiente, onEscolher }: { ambiente: Estado; onEscolher: (p: AmbientePronto) => void }) {
  const [grupo, setGrupo] = useState<Grupo>('todos')
  const ids = grupos.find((g) => g.id === grupo)?.ids
  const lista = ambientesProntos.filter((p) => !ids || ids.includes(p.id))
  const continuar = temConteudo(ambiente)

  return (
    <section className="px-3 pt-4 pb-14 md:px-5 md:pt-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col justify-between gap-6 px-2 animar-surgir lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow text-terracota">Ambientes 3D</p>
            <h1 className="mt-4 text-[44px] leading-[0.95] md:text-[64px] totem-v:text-[88px] totem-h:text-[72px]">Escolha um ambiente pronto</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-pedra">
              Comece de um projeto já decorado e deixe com a sua cara: pinte paredes e piso, troque revestimentos, mude portas e
              janelas, troque as cores dos móveis e adicione peças da loja.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {continuar && (
              <button type="button" onClick={() => irPara('3d')} className="botao cursor-pointer bg-musgo text-linho hover:bg-musgo-escuro">
                Continuar {ambiente.nome ? `“${ambiente.nome}”` : 'meu ambiente'} <Seta />
              </button>
            )}
            <button
              type="button"
              onClick={() => comecarDoZero()}
              className="botao cursor-pointer border border-tinta/15 bg-linho whitespace-nowrap hover:border-tinta"
            >
              <IconePlanta className="size-4 text-terracota" /> Começar do zero
            </button>
          </div>
        </div>

        <div className="mt-8 flex gap-1 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGrupo(g.id)}
              className={`shrink-0 cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold transition ${
                g.id === grupo ? 'bg-tinta text-linho' : 'text-pedra hover:bg-creme hover:text-tinta'
              }`}
            >
              {g.rotulo}
            </button>
          ))}
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 totem:gap-5 totem-v:grid-cols-2 totem-h:grid-cols-4">
          {lista.map((p, i) => (
            <li key={p.id} className="animar-surgir" style={{ animationDelay: `${i * 50}ms` }}>
              <CardPronto pronto={p} atual={ambiente.nome === p.nome} onClick={() => onEscolher(p)} />
            </li>
          ))}
          <li className="animar-surgir" style={{ animationDelay: `${lista.length * 50}ms` }}>
            <button
              type="button"
              onClick={() => comecarDoZero()}
              className="group flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-tinta/15 text-center transition hover:border-terracota hover:bg-creme"
            >
              <span className="grid size-12 place-items-center rounded-full bg-creme text-terracota transition group-hover:bg-linho">
                <Mais className="size-5" />
              </span>
              <span className="font-display text-xl leading-tight sm:text-2xl">Começar do zero</span>
              <span className="hidden px-6 text-xs font-semibold text-pedra sm:block">Desenhe o formato e as medidas do seu cômodo</span>
            </button>
          </li>
        </ul>
      </div>
    </section>
  )
}

function CardPronto({ pronto, atual, onClick }: { pronto: AmbientePronto; atual: boolean; onClick: () => void }) {
  const m2 = area(geometria(pronto.planta.cantos).contorno) / 10000
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[22px] bg-estudio text-left shadow-sm ring-1 ring-tinta/5 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
    >
      {pronto.foto ? (
        <img
          src={pronto.foto}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
      ) : (
        <MiniPlanta pronto={pronto} />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-tinta/80 via-tinta/10 to-transparent" />
      {atual && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-terracota px-2.5 py-1 text-[10px] font-bold tracking-wide text-linho uppercase">
          <Check className="size-3" /> Em edição
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 p-3.5 sm:p-5">
        <span className="block font-display text-[19px] leading-none text-linho min-[360px]:text-[22px] sm:text-[28px] totem-v:text-[40px] totem-h:text-[34px]">{pronto.nome}</span>
        <span className="mt-1.5 hidden truncate text-xs font-semibold text-linho/80 sm:block">{pronto.resumo}</span>
        <span className="mt-1 block text-[10px] font-bold tracking-wide text-linho/70 uppercase sm:mt-2 sm:text-[11px]">
          {formatarArea(m2)} m² · {pronto.itens.length} itens
        </span>
      </span>
      <span className="absolute top-3 right-3 grid size-9 translate-y-1 place-items-center rounded-full bg-linho text-tinta opacity-0 shadow transition group-hover:translate-y-0 group-hover:opacity-100">
        <Seta />
      </span>
    </button>
  )
}

/** Planta vista de cima, enquanto o card não tem foto. */
function MiniPlanta({ pronto }: { pronto: AmbientePronto }) {
  const { contorno } = geometria(pronto.planta.cantos)
  const c = caixa(contorno)
  const m = 60
  const a = { ...acabamentoPadrao, ...pronto.acabamento }
  return (
    <svg viewBox={`${c.x - m} ${c.y - m} ${c.largura + m * 2} ${c.altura + m * 2}`} className="absolute inset-0 size-full" aria-hidden>
      <rect x={c.x - m} y={c.y - m} width={c.largura + m * 2} height={c.altura + m * 2} fill={pronto.planta.grama ? '#8fa575' : '#ebe6dc'} />
      <polygon points={contorno.map((p) => `${p.x},${p.y}`).join(' ')} fill={a.corPiso} stroke="#1c1e1a" strokeWidth={8} />
      {pronto.itens.map((i, k) => {
        const med = i.medidas ?? buscarPeca(i.slug)?.medidas ?? { l: 60, p: 60 }
        return (
          <rect
            key={k}
            x={(i.x ?? 0) - med.l / 2}
            y={(i.y ?? 0) - med.p / 2}
            width={med.l}
            height={med.p}
            rx={6}
            transform={`rotate(${i.giro} ${i.x} ${i.y})`}
            fill={Object.values(i.cores ?? {})[0] ?? '#6e4a33'}
            fillOpacity={0.75}
          />
        )
      })}
    </svg>
  )
}

function Confirmacao({
  titulo,
  texto,
  acao,
  onCancelar,
  onConfirmar,
}: {
  titulo: string
  texto: string
  acao: string
  onCancelar: () => void
  onConfirmar: () => void
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCancelar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCancelar])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/40 p-4 backdrop-blur-sm" onClick={onCancelar}>
      <div role="dialog" aria-modal className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[28px] bg-linho p-6 shadow-2xl animar-surgir sm:p-7" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-[26px] leading-tight sm:text-[30px]">{titulo}</p>
        <p className="mt-3 leading-relaxed text-pedra">{texto}</p>
        <div className="mt-7 grid gap-2 min-[400px]:grid-cols-2">
          <button type="button" onClick={onCancelar} className="botao cursor-pointer border border-tinta/15 hover:border-tinta">
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className="botao cursor-pointer bg-terracota text-linho hover:bg-terracota-escuro">
            {acao}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Editor (planta e 3D) ----------------------------------------------------------

function Editor({ ambiente }: { ambiente: Estado }) {
  const geo = useMemo(() => geometria(ambiente.planta.cantos), [ambiente.planta.cantos])
  const medidas = useMemo(() => {
    const c = caixa(geo.contorno)
    return { area: area(geo.contorno) / 10000, largura: c.largura, profundidade: c.altura }
  }, [geo])
  const [catalogo, setCatalogo] = useState(false)
  const planta = ambiente.etapa === 'planta'

  return (
    <section className="px-3 pt-2 pb-10 md:px-5 totem:pb-4">
      <div className="mx-auto grid max-w-[1560px] gap-4 totem-h:max-w-none lg:grid-cols-[minmax(0,1fr)_420px] totem-v:grid-cols-1 totem-h:grid-cols-[minmax(0,1fr)_560px]">
        <div className={`${altura} animar-surgir`}>{planta ? <EditorPlanta planta={ambiente.planta} /> : <Cena3D ambiente={ambiente} />}</div>

        <aside className="relative flex flex-col overflow-hidden rounded-[28px] bg-creme animar-surgir [animation-delay:120ms] lg:h-[calc(100svh-150px)] lg:min-h-[620px] totem-v:h-[calc(54svh-150px)] totem-v:min-h-0 totem-h:h-[calc(100svh-140px)] totem-h:min-h-0">
          <div className="p-4 pb-0 sm:p-6 sm:pb-0 md:px-7">
            <Etapas etapa={ambiente.etapa} />
            <h1 className="mt-4 truncate text-[34px] leading-[0.95] sm:mt-5 sm:text-[40px] md:text-[46px]">
              {planta ? 'Monte seu espaço' : (ambiente.nome ?? 'Seu ambiente')}
            </h1>
            <p className="mt-2 text-xs font-bold tracking-wide text-pedra uppercase">
              {metros(medidas.largura)} × {metros(medidas.profundidade)} m · {formatarArea(medidas.area)} m² · pé-direito{' '}
              {metros(ambiente.planta.peDireito)} m
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pt-2 sm:p-6 sm:pt-2 md:px-7">
            {planta ? <PainelPlanta ambiente={ambiente} medidas={medidas} /> : <Painel3D ambiente={ambiente} geo={geo} />}
          </div>

          <div className="border-t border-tinta/10 bg-creme p-4 sm:p-5 md:px-7">
            {planta ? (
              <button
                type="button"
                onClick={() => irPara('3d')}
                className="botao w-full cursor-pointer bg-terracota py-4 text-base text-linho hover:bg-terracota-escuro"
              >
                <Cubo /> Gerar ambiente 3D
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCatalogo(true)}
                className="botao w-full cursor-pointer bg-terracota py-4 text-base text-linho hover:bg-terracota-escuro"
              >
                <Mais className="size-5" /> Adicionar peças e móveis
              </button>
            )}
            <p className="mt-3 text-center text-xs font-bold tracking-wide text-pedra uppercase">{contarItens(ambiente.itens.length)}</p>
          </div>

          {catalogo && <Catalogo onFechar={() => setCatalogo(false)} />}
        </aside>
      </div>
    </section>
  )
}

function Etapas({ etapa }: { etapa: Estado['etapa'] }) {
  const passo = (n: number, rotulo: string, ativo: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase transition totem:text-sm ${ativo ? 'text-tinta' : 'text-tinta/40 hover:text-tinta/70'}`}
    >
      <span className={`grid size-6 place-items-center rounded-full text-[11px] ${ativo ? 'bg-terracota text-linho' : 'border border-tinta/20'}`}>{n}</span>
      {rotulo}
    </button>
  )
  const traco = <span className="h-px w-3 shrink-0 bg-tinta/20 sm:w-4" />
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] sm:gap-2">
      {passo(1, 'Ambientes', false, () => irPara('galeria'))}
      {traco}
      {passo(2, 'Planta', etapa === 'planta', () => irPara('planta'))}
      {traco}
      {passo(3, 'Decorar', etapa === '3d', () => irPara('3d'))}
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-5 rounded-[20px] bg-linho p-5">
      <p className="eyebrow text-terracota">{titulo}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

// --- Etapa: planta -------------------------------------------------------------------

function PainelPlanta({ ambiente, medidas }: { ambiente: Estado; medidas: Medidas }) {
  const { planta } = ambiente
  const mudarPeDireito = (d: number) =>
    definirPlanta({ ...planta, peDireito: Math.min(PE_DIREITO.max, Math.max(PE_DIREITO.min, planta.peDireito + d)) })

  return (
    <>
      <p className="mt-4 leading-relaxed font-medium text-pedra">
        Escolha um formato e ajuste do seu jeito: arraste as paredes e as bolinhas dos cantos, arredonde cantos e marque portas e
        janelas.
      </p>

      <Bloco titulo="Formato">
        <div className="grid grid-cols-4 gap-2">
          {formatos.map((f) => {
            const ativo = planta.formato === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => escolherFormato(f.id)}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-1 py-3 text-[11px] font-bold transition ${
                  ativo ? 'border-terracota bg-terracota/10 text-tinta' : 'border-tinta/10 text-pedra hover:border-tinta/40'
                }`}
              >
                <MiniFormato cantos={f.cantos()} ativo={ativo} />
                {f.rotulo}
              </button>
            )
          })}
        </div>
      </Bloco>

      <Bloco titulo="Como editar">
        <ul className="space-y-4 text-sm font-medium">
          <Dica icone={<Mover />}>Arraste uma parede para afastar ou aproximar</Dica>
          <Dica icone={<span className="size-3 rounded-full border-2 border-tinta bg-linho" />}>
            Arraste uma bolinha para mover o canto; toque nela para arredondar
          </Dica>
          <Dica icone={<Porta />}>Escolha Porta ou Janela no topo e toque numa parede para colocar; arraste para mudar de lugar</Dica>
        </ul>
      </Bloco>

      <Bloco titulo="Pé-direito">
        <div className="flex items-center justify-between gap-3">
          <BotaoQuadrado rotulo="Diminuir pé-direito" onClick={() => mudarPeDireito(-PE_DIREITO.passo)}>
            <Menos />
          </BotaoQuadrado>
          <p className="font-display text-[34px] leading-none">{metros(planta.peDireito)} m</p>
          <BotaoQuadrado rotulo="Aumentar pé-direito" onClick={() => mudarPeDireito(PE_DIREITO.passo)}>
            <Mais />
          </BotaoQuadrado>
        </div>
      </Bloco>

      <dl className="mt-5 grid grid-cols-3 divide-x divide-tinta/10 rounded-[20px] border border-tinta/10">
        <Numero rotulo="Área">
          {formatarArea(medidas.area)} <small className="text-sm">m²</small>
        </Numero>
        <Numero rotulo="Portas">{planta.portas.length}</Numero>
        <Numero rotulo="Janelas">{planta.janelas.length}</Numero>
      </dl>
    </>
  )
}

function MiniFormato({ cantos, ativo }: { cantos: Parameters<typeof geometria>[0]; ativo: boolean }) {
  const { contorno } = geometria(cantos)
  const c = caixa(contorno)
  const k = Math.min(36 / c.largura, 28 / c.altura)
  const pts = contorno.map((p) => `${(p.x - c.x) * k + (40 - c.largura * k) / 2},${(p.y - c.y) * k + (32 - c.altura * k) / 2}`)
  return (
    <svg viewBox="0 0 40 32" className="h-8 w-10" aria-hidden>
      <polygon
        points={pts.join(' ')}
        fill={ativo ? 'var(--color-terracota)' : 'var(--color-tinta)'}
        fillOpacity={ativo ? 0.25 : 0.08}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Dica({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-tinta/10 text-terracota">{icone}</span>
      <span className="pt-2 leading-snug">{children}</span>
    </li>
  )
}

function BotaoQuadrado({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      className="grid size-12 cursor-pointer place-items-center rounded-full border border-tinta/15 transition hover:border-tinta hover:bg-white"
    >
      {children}
    </button>
  )
}

function Numero({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="px-3 py-4 sm:px-4">
      <dd className="font-display text-[21px] leading-none text-terracota sm:text-[26px]">{children}</dd>
      <dt className="mt-2 text-[11px] font-bold tracking-wide text-pedra uppercase">{rotulo}</dt>
    </div>
  )
}

// --- Estado compartilhado entre a cena e o painel ----------------------------------

/** Valor observável fora do React: a cena 3D também lê e escreve. */
function observavel<T>(inicial: T) {
  let atual = inicial
  const ouvintes = new Set<(v: T) => void>()
  return {
    ler: () => atual,
    definir: (v: T) => {
      atual = v
      ouvintes.forEach((fn) => fn(v))
    },
    usar: function useValor() {
      const [v, setV] = useState(atual)
      useEffect(() => {
        ouvintes.add(setV)
        setV(atual)
        return () => void ouvintes.delete(setV)
      }, [])
      return v
    },
  }
}

const selecao = observavel<string | null>(null)
const selecionar = selecao.definir
const useSelecao = selecao.usar

const situacoes = observavel<Record<string, Situacao>>({})
const useSituacoes = situacoes.usar

type Aba = 'paredes' | 'piso' | 'aberturas' | 'itens'
type EstadoPainel = { aba: Aba; parede: number }
const painel = observavel<EstadoPainel>({ aba: 'itens', parede: 0 })
const definirPainel = (m: Partial<EstadoPainel>) => painel.definir({ ...painel.ler(), ...m })
const usePainel = painel.usar

// --- Etapa: 3D -----------------------------------------------------------------------

const numero = (i: number) => String(i + 1).padStart(2, '0')

function Painel3D({ ambiente, geo }: { ambiente: Estado; geo: Geometria }) {
  const { aba } = usePainel()
  const abas: [Aba, string, ReactNode][] = [
    ['paredes', 'Paredes', <Paleta key="paredes" className="size-4" />],
    ['piso', 'Piso', <span key="piso" className="size-3.5 rounded-[4px] border-[1.5px] border-current" />],
    ['aberturas', 'Portas e janelas', <Porta key="aberturas" className="size-4" />],
    ['itens', `Itens · ${ambiente.itens.length}`, <Cubo key="itens" className="size-4" />],
  ]
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => irPara('galeria')}
          className="botao flex-1 cursor-pointer gap-1.5 border border-tinta/15 bg-linho px-2 py-2.5 text-xs whitespace-nowrap hover:border-tinta"
        >
          <Voltar className="size-4 text-terracota" /> Ambientes prontos
        </button>
        <button
          type="button"
          onClick={() => irPara('planta')}
          className="botao flex-1 cursor-pointer gap-1.5 border border-tinta/15 bg-linho px-2 py-2.5 text-xs whitespace-nowrap hover:border-tinta"
        >
          <IconePlanta className="size-4 text-terracota" /> Editar planta
        </button>
      </div>

      <div className="sticky top-0 z-10 -mx-1 mt-4 bg-creme px-1 pt-1 pb-2">
        <div className="grid grid-cols-4 gap-1 rounded-[18px] bg-linho p-1 ring-1 ring-tinta/5">
          {abas.map(([id, rotulo, icone]) => (
            <button
              key={id}
              type="button"
              onClick={() => definirPainel({ aba: id })}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-[14px] px-1 py-2 text-[10.5px] leading-tight font-bold transition totem:py-3 totem:text-sm ${
                aba === id ? 'bg-musgo text-linho' : 'text-pedra hover:bg-creme hover:text-tinta'
              }`}
            >
              {icone}
              <span className="text-center">{rotulo}</span>
            </button>
          ))}
        </div>
      </div>

      {aba === 'paredes' && <AbaParedes ambiente={ambiente} paredes={geo.paredes} />}
      {aba === 'piso' && <AbaPiso ambiente={ambiente} />}
      {aba === 'aberturas' && <AbaAberturas ambiente={ambiente} geo={geo} />}
      {aba === 'itens' && <AbaItens ambiente={ambiente} />}
    </>
  )
}

// --- Aba: paredes --------------------------------------------------------------------

function SeletorParede({
  paredes,
  atual,
  acabamento,
  planta,
}: {
  paredes: Geometria['paredes']
  atual: number
  acabamento: Acabamento
  planta: Planta
}) {
  return (
    <div>
      <Rotulo titulo="Parede" valor="ou toque nela no 3D" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {paredes.map((p, i) => {
          const aberta = alturaDaParede(planta, i) < 1
          return (
            <button
              key={i}
              type="button"
              onClick={() => definirPainel({ parede: i })}
              className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition ${
                i === atual ? 'border-terracota bg-terracota/10' : 'border-tinta/10 bg-linho hover:border-tinta/40'
              }`}
            >
              <span
                className={`size-4 shrink-0 rounded-full ring-1 ring-tinta/15 ${aberta ? 'border border-dashed border-tinta/40' : ''}`}
                style={{ backgroundColor: aberta ? 'transparent' : corDaParede(acabamento, i) }}
              />
              <span className="min-w-0 leading-tight">
                <span className="block text-xs font-bold">Parede {i + 1}</span>
                <span className="block text-[10px] font-semibold text-pedra">{aberta ? 'aberta' : `${metros(p.comprimento, 1)} m`}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AbaParedes({ ambiente, paredes }: { ambiente: Estado; paredes: Geometria['paredes'] }) {
  const { acabamento, planta } = ambiente
  const { parede } = usePainel()
  const porParede = acabamento.porParede
  const paredeAtual = Math.min(parede, paredes.length - 1)
  const corAtual = porParede ? corDaParede(acabamento, paredeAtual) : acabamento.paredes
  const papelAtual = porParede ? papelDaParede(acabamento, paredeAtual) : acabamento.papel
  const papel = papeis.find((p) => p.id === papelAtual)!

  const pintar = (hex: string, desfazivel = true) =>
    definirAcabamento(porParede ? { porParede: { ...porParede, [paredeAtual]: hex } } : { paredes: hex }, desfazivel)
  const revestir = (id: TipoPapel) =>
    definirAcabamento(
      porParede
        ? { papelPorParede: { ...acabamento.papelPorParede, [paredeAtual]: id }, porParede: { ...porParede, [paredeAtual]: corAtual } }
        : { papel: id },
    )

  const alturaAtual = planta.alturas?.[paredeAtual]
  const mudarAltura = (h: number | undefined) => {
    const alturas = { ...planta.alturas }
    if (h == null) delete alturas[paredeAtual]
    else alturas[paredeAtual] = h
    definirAberturas({ alturas })
  }

  return (
    <div className="mt-3 space-y-5">
      <Abas
        opcoes={[
          ['todas', 'Todas iguais'],
          ['cada', 'Uma por parede'],
        ]}
        atual={porParede ? 'cada' : 'todas'}
        onEscolher={(modo) => {
          if (modo === 'todas') definirAcabamento({ porParede: null })
          else if (!porParede) definirAcabamento({ porParede: {}, papelPorParede: {} })
        }}
        claro
      />

      {porParede && <SeletorParede paredes={paredes} atual={paredeAtual} acabamento={acabamento} planta={planta} />}

      <div>
        <Rotulo titulo={porParede ? `Revestimento da parede ${paredeAtual + 1}` : 'Revestimento'} valor={papel.rotulo} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {papeis.map((p) => {
            const ativo = p.id === papelAtual
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => !ativo && revestir(p.id)}
                className={`cursor-pointer overflow-hidden rounded-2xl border bg-linho text-left transition ${
                  ativo ? 'border-terracota ring-1 ring-terracota' : 'border-tinta/10 hover:border-tinta/40'
                }`}
              >
                <img src={miniaturaPapel(p.id, corAtual)} alt="" className="aspect-[4/3] w-full object-cover" />
                <span className="block truncate px-2 py-1.5 text-[11px] font-bold">{p.rotulo}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Rotulo titulo={porParede ? `Cor da parede ${paredeAtual + 1}` : 'Cor das paredes'} valor={nomeDaCor(coresParede, corAtual)} />
        <Amostras opcoes={coresParede} atual={corAtual} onEscolher={pintar} />
      </div>

      {porParede ? (
        <div>
          <Rotulo
            titulo={`Altura da parede ${paredeAtual + 1}`}
            valor={alturaAtual === 0 ? 'Aberta' : alturaAtual ? `${metros(alturaAtual)} m` : 'Inteira'}
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <BotaoAcao ativo={alturaAtual == null} onClick={() => mudarAltura(undefined)}>
              Inteira
            </BotaoAcao>
            <BotaoAcao ativo={alturaAtual === 110} onClick={() => mudarAltura(110)}>
              Mureta
            </BotaoAcao>
            <BotaoAcao ativo={alturaAtual === 0} onClick={() => mudarAltura(0)}>
              Sem parede
            </BotaoAcao>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-tinta/15 p-4 text-xs leading-relaxed font-semibold text-pedra">
          Para revestir só uma parede (um painel ripado atrás da TV, por exemplo) ou deixar uma parede aberta, escolha “Uma por parede”.
        </p>
      )}

      <ProvadorRA acabamento={acabamento} peDireito={planta.peDireito} />
    </div>
  )
}

// --- Aba: piso -----------------------------------------------------------------------

function AbaPiso({ ambiente }: { ambiente: Estado }) {
  const { acabamento } = ambiente
  const tipo = pisos.find((p) => p.id === acabamento.piso)!
  return (
    <div className="mt-3 space-y-5">
      {ambiente.planta.fachada && <p className="text-xs font-semibold text-pedra">Na fachada, o piso é a calçada em volta da casa.</p>}
      <div className="grid grid-cols-3 gap-2">
        {pisos.map((p) => {
          const ativo = p.id === acabamento.piso
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                !ativo &&
                definirAcabamento({
                  piso: p.id,
                  corPiso: p.cores.some((c) => c.hex === acabamento.corPiso) ? acabamento.corPiso : p.cores[0].hex,
                })
              }
              className={`cursor-pointer overflow-hidden rounded-2xl border bg-linho text-left transition ${
                ativo ? 'border-terracota ring-1 ring-terracota' : 'border-tinta/10 hover:border-tinta/40'
              }`}
            >
              <img src={miniaturaPiso(p.id, ativo ? acabamento.corPiso : p.cores[0].hex)} alt="" className="aspect-[4/3] w-full object-cover" />
              <span className="block truncate px-2 py-1.5 text-[11px] font-bold">{p.rotulo}</span>
            </button>
          )
        })}
      </div>
      <div>
        <Rotulo titulo="Cor do piso" valor={nomeDaCor(tipo.cores, acabamento.corPiso)} />
        <Amostras opcoes={tipo.cores} atual={acabamento.corPiso} onEscolher={(hex, d) => definirAcabamento({ corPiso: hex }, d)} />
      </div>
      <ProvadorRA acabamento={acabamento} peDireito={ambiente.planta.peDireito} />
    </div>
  )
}

// --- Aba: portas e janelas ---------------------------------------------------------

type Abertura = { tipo: 'porta'; v: TipoPorta } | { tipo: 'janela'; v: TipoJanela }

const rotuloAbertura = (a: Abertura) => (a.tipo === 'porta' ? 'Porta' : a.v.peitoril === 0 ? 'Porta de vidro' : 'Janela')

/** Centro livre na parede para uma abertura nova: do meio para as pontas, sem encostar nas que já existem. */
function lugarLivre(planta: Planta, geo: Geometria, parede: number, largura: number) {
  const p = geo.paredes[parede]
  const ocupados = [...planta.portas, ...planta.janelas]
    .filter((a) => a.parede === parede)
    .map((a) => [a.t - a.largura / 2 / p.comprimento, a.t + a.largura / 2 / p.comprimento])
  const meia = largura / 2 / p.comprimento
  for (let d = 0; d <= 0.5; d += 0.02)
    for (const t of [0.5 - d, 0.5 + d]) {
      const tl = limitarPorta(p, t, largura)
      if (!ocupados.some(([a, b]) => tl + meia > a - 0.01 && tl - meia < b + 0.01)) return tl
    }
  return null
}

function AbaAberturas({ ambiente, geo }: { ambiente: Estado; geo: Geometria }) {
  const { planta, acabamento } = ambiente
  const { parede } = usePainel()
  const paredeAtual = Math.min(parede, geo.paredes.length - 1)
  const [aviso, setAviso] = useState('')
  const aberta = alturaDaParede(planta, paredeAtual) < 1

  const adicionar = (tipo: 'porta' | 'janela' | 'vidro') => {
    const largura = tipo === 'porta' ? LARGURA_PORTA : tipo === 'janela' ? JANELA_PADRAO.largura : PORTA_VIDRO.largura
    const t = aberta ? null : lugarLivre(planta, geo, paredeAtual, largura)
    if (t == null) {
      setAviso(aberta ? 'Esta parede está aberta. Escolha outra parede.' : 'Não há espaço livre nesta parede. Escolha outra ou diminua uma abertura.')
      return
    }
    setAviso('')
    if (tipo === 'porta') definirAberturas({ portas: [...planta.portas, { id: novoIdPorta(), parede: paredeAtual, t, largura }] })
    else {
      const base = tipo === 'janela' ? JANELA_PADRAO : PORTA_VIDRO
      definirAberturas({ janelas: [...planta.janelas, { id: novoIdPorta(), parede: paredeAtual, t, ...base }] })
    }
  }

  const lista: Abertura[] = [
    ...planta.portas.map((v) => ({ tipo: 'porta' as const, v })),
    ...planta.janelas.map((v) => ({ tipo: 'janela' as const, v })),
  ].sort((a, b) => a.v.parede - b.v.parede || a.v.t - b.v.t)

  return (
    <div className="mt-3 space-y-5">
      <SeletorParede paredes={geo.paredes} atual={paredeAtual} acabamento={acabamento} planta={planta} />

      <div>
        <Rotulo titulo={`Colocar na parede ${paredeAtual + 1}`} valor="" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <BotaoAcao onClick={() => adicionar('porta')}>
            <Porta /> Porta
          </BotaoAcao>
          <BotaoAcao onClick={() => adicionar('janela')}>
            <Janela /> Janela
          </BotaoAcao>
          <BotaoAcao onClick={() => adicionar('vidro')}>
            <Janela vidro /> Vidro
          </BotaoAcao>
        </div>
        {aviso && <p className="mt-2 text-xs font-semibold text-terracota">{aviso}</p>}
      </div>

      {lista.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-tinta/20 p-5 text-sm leading-relaxed font-medium text-pedra">
          Nenhuma porta ou janela ainda. Escolha a parede e toque em Porta, Janela ou Vidro (porta de correr até o chão).
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((a) => (
            <CartaoAbertura key={a.v.id} abertura={a} planta={planta} geo={geo} ativa={a.v.parede === paredeAtual} />
          ))}
        </ul>
      )}

      <div className="rounded-[20px] bg-linho p-4">
        <Rotulo titulo="Caixilhos das janelas" valor={nomeDaCor(coresEsquadria, acabamento.esquadrias)} />
        <Amostras opcoes={coresEsquadria} atual={acabamento.esquadrias} onEscolher={(hex, d) => definirAcabamento({ esquadrias: hex }, d)} />
        <div className="mt-5">
          <Rotulo titulo="Portas" valor={nomeDaCor(coresPorta, acabamento.portas)} />
          <Amostras opcoes={coresPorta} atual={acabamento.portas} onEscolher={(hex, d) => definirAcabamento({ portas: hex }, d)} />
        </div>
      </div>
    </div>
  )
}

function CartaoAbertura({ abertura, planta, geo, ativa }: { abertura: Abertura; planta: Planta; geo: Geometria; ativa: boolean }) {
  const { tipo, v } = abertura
  const p = geo.paredes[v.parede]
  const h = alturaDaParede(planta, v.parede)
  if (!p) return null

  const mudar = (m: Partial<TipoJanela>, desfazivel = true) => {
    if (tipo === 'porta') {
      const largura = Math.max(60, Math.min(p.comprimento - 10, m.largura ?? v.largura))
      const nova = { ...v, ...m, largura, t: limitarPorta(p, m.t ?? v.t, largura) }
      definirAberturas({ portas: planta.portas.map((x) => (x.id === v.id ? nova : x)) }, desfazivel)
    } else {
      const largura = Math.max(40, Math.min(p.comprimento - 10, m.largura ?? v.largura))
      const peitoril = Math.max(0, Math.min(h - 40, m.peitoril ?? v.peitoril))
      const alturaJ = Math.max(30, Math.min(h - peitoril - 5, m.altura ?? v.altura))
      const nova = { ...v, ...m, largura, peitoril, altura: alturaJ, t: limitarPorta(p, m.t ?? v.t, largura) }
      definirAberturas({ janelas: planta.janelas.map((x) => (x.id === v.id ? nova : x)) }, desfazivel)
    }
  }
  const remover = () =>
    definirAberturas(
      tipo === 'porta' ? { portas: planta.portas.filter((x) => x.id !== v.id) } : { janelas: planta.janelas.filter((x) => x.id !== v.id) },
    )
  const alturaPorta = tipo === 'porta' ? (v.altura ?? ALTURA_PORTA) : 0

  return (
    <li className={`rounded-[20px] bg-linho p-4 transition ${ativa ? 'ring-2 ring-terracota' : 'ring-1 ring-tinta/5'}`}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => definirPainel({ parede: v.parede })} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-creme text-terracota">
            {tipo === 'porta' ? <Porta /> : <Janela vidro={v.peitoril === 0} />}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-xl leading-tight">{rotuloAbertura(abertura)}</span>
            <span className="block text-[11px] font-bold text-pedra">
              Parede {v.parede + 1} · {v.largura} × {tipo === 'porta' ? alturaPorta : v.altura} cm
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={remover}
          aria-label="Remover"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-tinta/15 transition hover:border-tinta hover:bg-white"
        >
          <Lixeira />
        </button>
      </div>

      <label className="mt-4 block">
        <span className="text-[11px] font-bold tracking-wide text-pedra uppercase">Posição na parede</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.002}
          value={v.t}
          onPointerDown={() => marcarDesfazer('3d')}
          onChange={(e) => mudar({ t: Number(e.target.value) }, false)}
          className="mt-2 w-full cursor-pointer accent-[var(--color-terracota)]"
        />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <Passo rotulo="Largura" valor={v.largura} onMudar={(d) => mudar({ largura: v.largura + d })} />
        {tipo === 'porta' ? (
          <Passo rotulo="Altura" valor={alturaPorta} onMudar={(d) => mudar({ altura: Math.max(180, Math.min(h - 10, alturaPorta + d)) })} />
        ) : (
          <Passo rotulo="Altura" valor={v.altura} onMudar={(d) => mudar({ altura: v.altura + d })} />
        )}
        {tipo === 'janela' && <Passo rotulo="Peitoril" valor={v.peitoril} onMudar={(d) => mudar({ peitoril: v.peitoril + d })} />}
      </div>
    </li>
  )
}

function Passo({ rotulo, valor, onMudar, passo = 10 }: { rotulo: string; valor: number; onMudar: (d: number) => void; passo?: number }) {
  return (
    <div className="rounded-2xl border border-tinta/10 p-2">
      <p className="px-1 text-[10px] font-bold tracking-wide text-pedra uppercase">{rotulo}</p>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={`Diminuir ${rotulo.toLowerCase()}`}
          onClick={() => onMudar(-passo)}
          className="grid size-8 cursor-pointer place-items-center rounded-full bg-creme transition hover:bg-areia"
        >
          <Menos />
        </button>
        <span className="text-sm font-bold tabular-nums">{valor} cm</span>
        <button
          type="button"
          aria-label={`Aumentar ${rotulo.toLowerCase()}`}
          onClick={() => onMudar(passo)}
          className="grid size-8 cursor-pointer place-items-center rounded-full bg-creme transition hover:bg-areia"
        >
          <Mais />
        </button>
      </div>
    </div>
  )
}

// --- Aba: itens ----------------------------------------------------------------------

type Info = { nome: string; imagem: string; movel?: Movel; peca?: Peca }

function infoItem(item: Item): Info | null {
  const movel = buscarMovel(item.slug)
  if (movel) {
    const cor = movel.cores[item.cor] ?? movel.cores[0]
    return { nome: movel.nome, imagem: cor.imagem ?? movel.imagem, movel }
  }
  const peca = buscarPeca(item.slug)
  return peca ? { nome: peca.nome, imagem: miniaturaPeca(peca.slug), peca } : null
}

function AbaItens({ ambiente }: { ambiente: Estado }) {
  const selecionado = useSelecao()
  const s = useSituacoes()
  if (ambiente.itens.length === 0)
    return (
      <p className="mt-3 rounded-[20px] border border-dashed border-tinta/20 p-5 text-sm leading-relaxed font-medium text-pedra">
        Nenhum item ainda. Toque em “Adicionar peças e móveis” para escolher do catálogo da loja ou das peças de ambientação.
      </p>
    )
  return (
    <ul className="mt-3 space-y-3">
      {ambiente.itens.map((item, i) => (
        <CartaoItem key={item.id} item={item} indice={i} aberto={item.id === selecionado} situacao={s[item.id]} />
      ))}
    </ul>
  )
}

const elevar = (item: Item, cm: number) =>
  atualizarItem(item.id, { elevacao: Math.min(lerAmbiente().planta.peDireito, Math.max(0, (item.elevacao ?? 0) + cm)) })

const girar = (item: Item, graus: number) => atualizarItem(item.id, { giro: (((item.giro + graus) % 360) + 360) % 360 })

const nomesEixo = { l: 'Largura', p: 'Profundidade', a: 'Altura' }

function CartaoItem({ item, indice, aberto, situacao }: { item: Item; indice: number; aberto: boolean; situacao?: Situacao }) {
  const info = infoItem(item)
  const ref = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (aberto) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [aberto])

  if (!info) return null
  const { movel, peca } = info

  return (
    <li ref={ref} className={`overflow-hidden rounded-[20px] bg-linho transition ${aberto ? 'ring-2 ring-terracota' : 'ring-1 ring-tinta/5'}`}>
      <button type="button" onClick={() => selecionar(aberto ? null : item.id)} className="flex w-full cursor-pointer items-center gap-3 p-3 text-left">
        <img src={info.imagem} alt="" className="size-14 shrink-0 rounded-xl bg-estudio object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl leading-tight">{info.nome}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-pedra">
            Nº {numero(indice)}
            {movel && <span className="rounded-full bg-terracota/10 px-1.5 text-terracota">Loja</span>}
            {/* A folga de 50 cm fica para o botão "Área de uso"; aqui, só o que de fato não cabe. */}
            {situacao === 'naoCabe' && (
              <>
                <span className="size-1.5 rounded-full" style={{ backgroundColor: coresSituacao[situacao] }} />
                <span style={{ color: coresSituacao[situacao] }}>{rotulosSituacao[situacao]}</span>
              </>
            )}
          </span>
        </span>
        <Mais className={`size-4 shrink-0 text-pedra transition ${aberto ? 'rotate-45' : ''}`} />
      </button>

      {aberto && (
        <div className="space-y-5 border-t border-tinta/10 p-4">
          {movel && movel.cores.length > 1 && (
            <div>
              <Rotulo titulo="Cor" valor={(movel.cores[item.cor] ?? movel.cores[0]).nome} />
              <div className="mt-3">
                <SeletorCores cores={movel.cores} selecionada={item.cor} onSelecionar={(c) => atualizarItem(item.id, { cor: c })} tamanho="g" />
              </div>
            </div>
          )}

          {peca?.partes.map((pt) => {
            const atual = item.cores?.[pt.id] ?? pt.cores[0].hex
            return (
              <div key={pt.id}>
                <Rotulo titulo={pt.rotulo} valor={nomeDaCor(pt.cores, atual)} />
                <Amostras
                  opcoes={pt.cores}
                  atual={atual}
                  onEscolher={(hex, d) => atualizarItem(item.id, { cores: { ...coresPadrao(peca), ...item.cores, [pt.id]: hex } }, d)}
                />
              </div>
            )
          })}

          {peca?.ajuste && (
            <div>
              <Rotulo titulo="Medidas" valor="" />
              <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                {(Object.entries(peca.ajuste) as [keyof Peca['medidas'], [number, number]][]).map(([eixo, [min, max]]) => {
                  const med = item.medidas ?? peca.medidas
                  return (
                    <Passo
                      key={eixo}
                      rotulo={nomesEixo[eixo]}
                      valor={med[eixo]}
                      onMudar={(d) => atualizarItem(item.id, { medidas: { ...med, [eixo]: Math.min(max, Math.max(min, med[eixo] + d)) } })}
                    />
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <Rotulo titulo="Giro" valor={`${item.giro}°`} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <BotaoAcao onClick={() => girar(item, -15)}>
                <GirarAnti /> 15°
              </BotaoAcao>
              <BotaoAcao onClick={() => girar(item, 15)}>
                <Girar /> 15°
              </BotaoAcao>
              <BotaoAcao onClick={() => girar(item, 90)}>
                <Girar /> 90°
              </BotaoAcao>
            </div>
          </div>

          {!peca?.rasteira && (
            <div>
              <Rotulo titulo="Altura do chão" valor={`${item.elevacao ?? 0} cm`} />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <BotaoAcao onClick={() => elevar(item, -5)}>
                  <Menos /> 5 cm
                </BotaoAcao>
                <BotaoAcao onClick={() => elevar(item, 5)}>
                  <Mais /> 5 cm
                </BotaoAcao>
                <BotaoAcao onClick={() => atualizarItem(item.id, { elevacao: 0 })}>No chão</BotaoAcao>
              </div>
              {(movel?.categoria === 'Decoração' || peca?.categoria === 'Decoração') && (
                <p className="mt-2 text-xs font-medium text-pedra">Dica: arraste a peça para cima de uma mesa ou balcão para apoiá-la nele.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <BotaoAcao onClick={() => selecionar(duplicarItem(item.id) ?? null)}>
              <Duplicar /> Duplicar
            </BotaoAcao>
            <BotaoAcao
              onClick={() => {
                removerItem(item.id)
                selecionar(null)
              }}
            >
              <Lixeira /> Remover
            </BotaoAcao>
          </div>
          {movel && (
            <a href={`#/movel/${movel.slug}`} className="flex items-center justify-between text-xs font-bold text-terracota hover:underline">
              Ver esta peça na loja <Seta />
            </a>
          )}
        </div>
      )}
    </li>
  )
}

function BotaoAcao({ onClick, ativo, children }: { onClick: () => void; ativo?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`botao cursor-pointer gap-1.5 border px-2 py-2.5 text-xs sm:gap-2.5 sm:px-3 ${
        ativo ? 'border-terracota bg-terracota/10' : 'border-tinta/15 hover:border-tinta hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}

// --- Catálogo dentro do editor -----------------------------------------------------

type Filtro = 'loja' | CategoriaPeca
type Opcao = { slug: string; nome: string; grupo: Filtro; imagem: () => string; detalhe: string; adicionar: () => string }

const opcoesCatalogo: Opcao[] = [
  ...moveis
    .filter((m) => m.modelo)
    .map((m) => ({
      slug: m.slug,
      nome: m.nome,
      grupo: 'loja' as Filtro,
      imagem: () => m.imagem,
      detalhe: m.categoria,
      adicionar: () => adicionarItem(m.slug, 0),
    })),
  ...pecas.map((p) => ({
    slug: p.slug,
    nome: p.nome,
    grupo: p.categoria as Filtro,
    imagem: () => miniaturaPeca(p.slug),
    detalhe: `${p.medidas.l} × ${p.medidas.p} cm`,
    adicionar: () => adicionarPeca(p.slug, { ...p.medidas }, coresPadrao(p), p.elevacao),
  })),
]

function Catalogo({ onFechar }: { onFechar: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>('loja')
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const opcoes = opcoesCatalogo.filter((o) => (termo ? o.nome.toLowerCase().includes(termo) : o.grupo === filtro))

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])

  const filtros: [Filtro, string][] = [['loja', 'Da loja'], ...categoriasPeca.map((c) => [c, c] as [Filtro, string])]

  // No celular o painel fica embaixo da cena e é curto: o catálogo abre em tela cheia.
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-creme pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animar-surgir [animation-duration:.35s] lg:absolute lg:z-20 lg:p-0 totem:absolute totem:z-20 totem:p-0">
      <div className="flex items-center justify-between gap-3 p-6 pb-3 md:px-7">
        <p className="font-display text-[32px] leading-none">Adicionar</p>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="grid size-10 cursor-pointer place-items-center rounded-full border border-tinta/15 transition hover:border-tinta hover:bg-white"
        >
          <Fechar className="size-5" />
        </button>
      </div>
      <div className="px-6 md:px-7">
        <input
          hidden={totem}
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: bancada, sofá, piscina…"
          className="w-full rounded-full border border-tinta/15 bg-linho px-5 py-3 text-sm font-medium outline-none placeholder:text-pedra/70 focus:border-terracota"
        />
        {!termo && (
          <div className="-mx-6 mt-3 flex gap-1.5 overflow-x-auto totem:flex-wrap px-6 pb-1 [scrollbar-width:none] md:-mx-7 md:px-7">
            {filtros.map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={`shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-xs font-bold transition ${
                  id === filtro ? 'bg-musgo text-linho' : 'bg-linho text-pedra hover:text-tinta'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-6 pt-4 md:px-7">
        {opcoes.length === 0 ? (
          <p className="text-sm font-medium text-pedra">Nada encontrado para “{busca}”.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 totem:grid-cols-2">
            {opcoes.map((o) => (
              <li key={o.slug}>
                <button
                  type="button"
                  onClick={() => {
                    const id = o.adicionar()
                    selecionar(id)
                    definirPainel({ aba: 'itens' })
                    onFechar()
                  }}
                  className="group w-full cursor-pointer overflow-hidden rounded-[18px] bg-linho text-left ring-1 ring-tinta/5 transition hover:ring-terracota"
                >
                  <span className="relative block aspect-square bg-estudio">
                    <img src={o.imagem()} alt="" loading="lazy" className="absolute inset-0 size-full object-contain p-2" />
                    <span className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-linho text-terracota shadow transition group-hover:bg-terracota group-hover:text-linho">
                      <Mais />
                    </span>
                  </span>
                  <span className="block px-3 pt-2 text-[13px] leading-tight font-bold totem:text-base">{o.nome}</span>
                  <span className="block px-3 pb-3 text-[11px] font-semibold text-pedra totem:text-sm">{o.detalhe}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// --- Cena 3D -------------------------------------------------------------------------

function Cena3D({ ambiente }: { ambiente: Estado }) {
  const container = useRef<HTMLDivElement>(null)
  const rotulo = useRef<HTMLDivElement>(null)
  const cena = useRef<CenaAmbiente | null>(null)
  const [modo, setModo] = useState<Modo>(() => modoInicial)
  const [areaUso, setAreaUso] = useState(false)
  const selecionado = useSelecao()
  const { aba, parede } = usePainel()

  useEffect(() => {
    const c = new CenaAmbiente(container.current!, rotulo.current, {
      aoSelecionar: (id) => {
        selecionar(id)
        if (id) definirPainel({ aba: 'itens' })
      },
      aoMover: (mudancas) => atualizarItens(mudancas),
      aoPosicionar: (id, x, y) => atualizarItem(id, { x, y }, false),
      aoSituacoes: situacoes.definir,
      aoTocarParede: (p) => definirPainel({ aba: painel.ler().aba === 'aberturas' ? 'aberturas' : 'paredes', parede: p }),
      aoTocarPiso: () => definirPainel({ aba: 'piso' }),
    })
    cena.current = c
    return () => {
      c.destruir()
      cena.current = null
    }
  }, [])

  useEffect(() => {
    cena.current?.definirAcabamento(ambiente.acabamento)
  }, [ambiente.acabamento])

  useEffect(() => {
    cena.current?.definirPlanta(ambiente.planta)
  }, [ambiente.planta])

  const destaque = aba === 'aberturas' || (aba === 'paredes' && ambiente.acabamento.porParede) ? parede : null
  useEffect(() => {
    cena.current?.destacarParede(destaque)
  }, [destaque])

  useEffect(() => {
    cena.current?.definirItens(ambiente.itens)
  }, [ambiente.itens])

  useEffect(() => {
    cena.current?.selecionar(selecionado)
  }, [selecionado])

  useEffect(() => {
    cena.current?.definirModo(modo)
  }, [modo])

  useEffect(() => {
    cena.current?.definirAreaUso(areaUso)
  }, [areaUso])

  const fotografar = () => {
    const url = cena.current?.capturar()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${(ambiente.nome ?? 'meu-ambiente').toLowerCase().replace(/\s+/g, '-')}.jpg`
    a.click()
  }

  const indice = ambiente.itens.findIndex((i) => i.id === selecionado)
  const item = ambiente.itens[indice]
  const info = item && infoItem(item)

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-estudio">
      <div ref={container} className="absolute inset-0" />

      <div
        ref={rotulo}
        className="pointer-events-none absolute top-0 left-0 rounded-full bg-tinta/85 px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-linho shadow-lg backdrop-blur"
        style={{ visibility: 'hidden' }}
      >
        {info && `Nº ${numero(indice)} · ${info.nome}`}
      </div>

      {areaUso && (
        <ul className="pointer-events-none absolute top-4 left-4 hidden space-y-1.5 rounded-[18px] bg-linho/90 px-4 py-3 text-[11px] font-bold shadow-sm backdrop-blur sm:block">
          {(Object.keys(rotulosSituacao) as Situacao[]).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: coresSituacao[s] }} />
              {rotulosSituacao[s]}
            </li>
          ))}
        </ul>
      )}

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-full bg-linho/90 p-1 shadow-sm backdrop-blur">
          <BotaoBarra disabled={!podeDesfazer('3d')} onClick={() => desfazer('3d')} rotulo="Desfazer">
            <Desfazer />
          </BotaoBarra>
          <span className="h-5 w-px bg-tinta/10" />
          <BotaoBarra ativo={modo === 'dentro'} onClick={() => setModo('dentro')} rotulo="Dentro">
            <Pessoa />
          </BotaoBarra>
          <BotaoBarra ativo={modo === '3d'} onClick={() => setModo('3d')} rotulo="3D">
            <Cubo className="size-4" />
          </BotaoBarra>
          <BotaoBarra ativo={modo === 'planta'} onClick={() => setModo('planta')} rotulo="Planta">
            <IconePlanta className="size-4" />
          </BotaoBarra>
          <span className="h-5 w-px bg-tinta/10" />
          <BotaoBarra onClick={() => cena.current?.centralizar()} rotulo="Centralizar">
            <Alvo />
          </BotaoBarra>
          {!totem && (
            <BotaoBarra onClick={fotografar} rotulo="Baixar foto">
              <Camera className="size-4" />
            </BotaoBarra>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAreaUso((v) => !v)}
          aria-pressed={areaUso}
          className={`botao cursor-pointer px-4 py-2 text-xs shadow-sm backdrop-blur ${
            areaUso ? 'bg-terracota text-linho hover:bg-terracota-escuro' : 'bg-linho/90 hover:bg-linho'
          }`}
        >
          <Olho /> Área de uso {AREA_USO} cm
        </button>
      </div>

      {modo === 'dentro' && <Direcional cena={cena} />}

      {ambiente.itens.length === 0 && (
        <div className="absolute inset-x-4 top-[calc(50%+1.5rem)] mx-auto max-w-sm -translate-y-1/2 rounded-[24px] bg-linho/95 p-5 text-center sm:top-1/2 sm:p-6 shadow-xl backdrop-blur animar-surgir">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-creme text-terracota">
            <Check className="size-6" />
          </span>
          <p className="mt-4 font-display text-[24px] leading-tight sm:text-[28px]">Seu cômodo está pronto</p>
          <p className="mt-2 text-sm font-medium text-pedra">
            Toque nas paredes e no piso para pintar e em “Adicionar peças e móveis” para mobiliar. Ou comece de um ambiente pronto.
          </p>
          <button type="button" onClick={() => irPara('galeria')} className="botao mt-5 w-full cursor-pointer bg-musgo text-linho hover:bg-musgo-escuro">
            Ver ambientes prontos <Seta />
          </button>
        </div>
      )}

      {item && info ? (
        <div className="absolute inset-x-4 bottom-4 mx-auto flex max-w-fit items-center gap-1.5 rounded-full bg-linho p-1.5 shadow-xl animar-surgir">
          <span className="hidden max-w-48 truncate px-3 font-display text-lg sm:block">{info.nome}</span>
          <BotaoFlutuante onClick={() => girar(item, 90)}>
            <Girar /> <span className="max-[399px]:sr-only">Girar</span>
          </BotaoFlutuante>
          <BotaoFlutuante onClick={() => selecionar(duplicarItem(item.id) ?? null)}>
            <Duplicar /> <span className="max-[399px]:sr-only">Duplicar</span>
          </BotaoFlutuante>
          <BotaoFlutuante
            escuro
            onClick={() => {
              removerItem(item.id)
              selecionar(null)
            }}
          >
            <Lixeira /> <span className="max-[399px]:sr-only">Remover</span>
          </BotaoFlutuante>
        </div>
      ) : (
        ambiente.itens.length > 0 && (
          <p className="pointer-events-none absolute bottom-4 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-linho/90 px-4 py-2 text-xs font-bold shadow-sm backdrop-blur">
            {/* No celular, a dica curta: a longa não cabe numa linha. */}
            <span className="sm:hidden">
              {modo === 'dentro'
                ? 'Arraste para olhar · toque 2× no piso para ir'
                : modo === '3d'
                  ? 'Toque na parede ou no piso para pintar'
                  : 'Arraste os itens · pinça para zoom'}
            </span>
            <span className="hidden sm:inline">
              {modo === 'dentro'
                ? 'Arraste para olhar em volta · toque duas vezes no piso para ir até lá · use as setas para andar'
                : modo === '3d'
                  ? 'Toque numa parede ou no piso para pintar · arraste os itens · arraste o fundo para girar'
                  : 'Arraste os itens · arraste o fundo para mover · pinça para zoom'}
            </span>
          </p>
        )
      )}
    </div>
  )
}

/** Direcional para andar na vista de dentro (segurar anda sem parar). */
function Direcional({ cena }: { cena: { current: CenaAmbiente | null } }) {
  const timer = useRef<number | null>(null)
  const parar = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }
  useEffect(() => parar, [])
  const botao = (rotulo: string, frente: number, lado: number, classe: string, giro: string) => (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        cena.current?.andar(frente, lado)
        parar()
        timer.current = window.setInterval(() => cena.current?.andar(frente, lado), 120)
      }}
      onPointerUp={parar}
      onPointerCancel={parar}
      onLostPointerCapture={parar}
      className={`grid size-10 cursor-pointer touch-none place-items-center rounded-full totem:size-14 bg-linho/90 shadow-sm backdrop-blur transition select-none hover:bg-linho active:scale-95 ${classe}`}
    >
      <Seta className={`size-4 ${giro}`} />
    </button>
  )
  return (
    <div className="absolute bottom-16 left-4 grid grid-cols-3 grid-rows-3 gap-1 animar-surgir">
      {botao('Andar para frente', 0.25, 0, 'col-start-2', '-rotate-90')}
      {botao('Andar para a esquerda', 0, -0.25, 'col-start-1 row-start-2', 'rotate-180')}
      {botao('Andar para a direita', 0, 0.25, 'col-start-3 row-start-2', '')}
      {botao('Andar para trás', -0.25, 0, 'col-start-2 row-start-3', 'rotate-90')}
    </div>
  )
}

function BotaoBarra({
  rotulo,
  ativo,
  disabled,
  onClick,
  children,
}: {
  rotulo: string
  ativo?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition enabled:cursor-pointer disabled:text-tinta/30 ${
        ativo ? 'bg-musgo text-linho' : 'enabled:hover:bg-creme'
      }`}
    >
      {children}
      <span className="hidden xl:inline totem:inline">{rotulo}</span>
    </button>
  )
}

function BotaoFlutuante({ escuro, onClick, children }: { escuro?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`botao cursor-pointer px-3.5 py-2.5 text-xs sm:px-4 ${escuro ? 'bg-tinta text-linho hover:bg-tinta/85' : 'border border-tinta/15 hover:border-tinta'}`}
    >
      {children}
    </button>
  )
}

/** Só a cena do ambiente pronto, em tela cheia, para gerar a foto do card (`#/ambiente/foto/<id>`). */
function FotoPronto({ id, casinha }: { id: string; casinha?: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const p = buscarPronto(id)
    if (!p) return
    const nada = () => {}
    const c = new CenaAmbiente(container.current!, null, {
      aoSelecionar: nada,
      aoMover: nada,
      aoPosicionar: nada,
      aoSituacoes: nada,
      aoTocarParede: nada,
    })
    c.definirAcabamento({ ...acabamentoPadrao, ...p.acabamento })
    c.definirPlanta(p.planta)
    c.definirItens(p.itens.map((i, k) => ({ ...i, id: `f${k}` })))
    // Como quem está dentro do ambiente; a fachada, de fora. `#/ambiente/foto/<id>/cima`: casa de bonecas.
    c.definirModo(p.planta.fachada || casinha ? '3d' : 'dentro')
    c.pronto().then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          c.centralizar()
          document.title = 'pronto'
        }),
      ),
    )
    return () => c.destruir()
  }, [id, casinha])
  return <div ref={container} className="fixed inset-0 z-[100] bg-estudio" />
}

// --- Controles de cor ------------------------------------------------------------------

const nomeDaCor = (opcoes: OpcaoCor[], hex: string) => opcoes.find((c) => c.hex === hex)?.nome ?? 'Personalizada'

function Rotulo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs font-bold tracking-wide uppercase">
      <span className="text-pedra">{titulo}</span>
      <span className="truncate text-terracota">{valor}</span>
    </div>
  )
}

function Abas<T extends string>({
  opcoes,
  atual,
  onEscolher,
  claro,
}: {
  opcoes: [T, string][]
  atual: T
  onEscolher: (v: T) => void
  claro?: boolean
}) {
  return (
    <div className={`grid grid-cols-2 gap-1 rounded-full p-1 ${claro ? 'border border-tinta/10 bg-linho' : 'bg-creme'}`}>
      {opcoes.map(([v, rotulo]) => (
        <button
          key={v}
          type="button"
          onClick={() => onEscolher(v)}
          className={`cursor-pointer rounded-full px-3 py-2 text-xs font-bold transition ${
            v === atual ? (claro ? 'bg-terracota text-linho' : 'bg-musgo text-linho') : 'text-pedra hover:text-tinta'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  )
}

/** Cores prontas e uma cor livre (seletor do sistema). Metais ganham um brilho na amostra. */
function Amostras({
  opcoes,
  atual,
  onEscolher,
}: {
  opcoes: OpcaoCor[]
  atual: string
  onEscolher: (hex: string, desfazivel?: boolean) => void
}) {
  const livre = !opcoes.some((c) => c.hex === atual)
  return (
    <div className="mt-3 flex flex-wrap gap-2.5">
      {opcoes.map((c) => (
        <button
          key={c.nome + c.hex}
          type="button"
          title={c.nome}
          aria-label={c.nome}
          onClick={() => onEscolher(c.hex)}
          className={`size-9 cursor-pointer rounded-full border-2 border-linho transition ${
            c.hex === atual ? 'scale-110 ring-[1.5px] ring-tinta' : 'ring-1 ring-tinta/15 hover:ring-tinta/50'
          }`}
          style={{
            backgroundColor: c.hex,
            backgroundImage: c.metal ? 'linear-gradient(135deg, rgba(255,255,255,.55), transparent 55%)' : undefined,
          }}
        />
      ))}
      <label
        title="Escolher outra cor"
        className={`relative size-9 cursor-pointer rounded-full border-2 border-linho transition ${
          livre ? 'scale-110 ring-[1.5px] ring-tinta' : 'ring-1 ring-tinta/15 hover:ring-tinta/50'
        }`}
        style={{ background: livre ? atual : 'conic-gradient(#e0533d, #e8b33a, #6fbf5a, #3aa3c9, #6a5fd1, #c94f9b, #e0533d)' }}
      >
        <span className="sr-only">Escolher outra cor</span>
        <input
          type="color"
          value={atual}
          onClick={() => marcarDesfazer('3d')}
          onChange={(e) => onEscolher(e.target.value, false)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
