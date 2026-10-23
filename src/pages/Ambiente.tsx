import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorPlanta } from '../components/EditorPlanta'
import {
  Alvo,
  Check,
  Cubo,
  Desfazer,
  Duplicar,
  Girar,
  GirarAnti,
  Lixeira,
  Mais,
  Menos,
  Mover,
  Olho,
  Paleta,
  Planta as IconePlanta,
  Porta,
} from '../components/Icones'
import { SeletorCores } from '../components/SeletorCores'
import { buscarMovel } from '../data/moveis'
import {
  area,
  AREA_USO,
  atualizarItem,
  atualizarItens,
  caixa,
  contarMoveis,
  coresParede,
  coresSituacao,
  corDaParede,
  definirAcabamento,
  definirPlanta,
  desfazer,
  duplicarItem,
  escolherFormato,
  formatos,
  geometria,
  irPara,
  lerAmbiente,
  marcarDesfazer,
  metros,
  PE_DIREITO,
  pisos,
  podeDesfazer,
  removerItem,
  rotulosSituacao,
  useAmbiente,
  type Acabamento,
  type Ambiente as Estado,
  type Geometria,
  type Item,
  type OpcaoCor,
  type Situacao,
} from '../lib/ambiente'
import { CenaAmbiente, type Modo } from '../lib/cena3d'
import { miniaturaPiso } from '../lib/texturasPiso'
import { hrefSecao } from '../router'

const altura = 'h-[62svh] min-h-[440px] lg:h-[calc(100svh-150px)] lg:min-h-[620px]'

export function Ambiente() {
  const ambiente = useAmbiente()
  const geo = useMemo(() => geometria(ambiente.planta.cantos), [ambiente.planta.cantos])
  const medidas = useMemo(() => {
    const c = caixa(geo.contorno)
    return { area: area(geo.contorno) / 10000, largura: c.largura, profundidade: c.altura }
  }, [geo])

  return (
    <section className="px-3 pt-2 pb-10 md:px-5">
      <div className="mx-auto grid max-w-[1560px] gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className={`${altura} animar-surgir`}>
          {ambiente.etapa === 'planta' ? <EditorPlanta planta={ambiente.planta} /> : <Cena3D ambiente={ambiente} />}
        </div>

        <aside
          className="flex flex-col overflow-hidden rounded-[28px] bg-creme animar-surgir [animation-delay:120ms] lg:h-[calc(100svh-150px)] lg:min-h-[620px]"
        >
          <div className="flex-1 overflow-y-auto p-6 md:p-7">
            <Etapas etapa={ambiente.etapa} />
            <h1 className="mt-6 text-[44px] leading-[0.95] md:text-[52px]">Monte seu espaço</h1>
            {ambiente.etapa === 'planta' ? (
              <PainelPlanta ambiente={ambiente} medidas={medidas} />
            ) : (
              <PainelMoveis ambiente={ambiente} medidas={medidas} />
            )}
          </div>

          <div className="border-t border-tinta/10 bg-creme p-5 md:px-7">
            {ambiente.etapa === 'planta' ? (
              <button
                type="button"
                onClick={() => irPara('3d')}
                className="botao w-full cursor-pointer bg-terracota py-4 text-base text-linho hover:bg-terracota-escuro"
              >
                <Cubo /> Gerar ambiente 3D
              </button>
            ) : (
              <a href={hrefSecao('catalogo')} className="botao w-full bg-terracota py-4 text-base text-linho hover:bg-terracota-escuro">
                <Mais className="size-5" /> Adicionar móveis
              </a>
            )}
            <p className="mt-3 text-center text-xs font-bold tracking-wide text-pedra uppercase">
              {contarMoveis(ambiente.itens.length)}
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

type Medidas = { area: number; largura: number; profundidade: number }

const formatarArea = (m2: number) => m2.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Etapas({ etapa }: { etapa: Estado['etapa'] }) {
  const passo = (n: number, rotulo: string, ativo: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-2 text-xs font-bold tracking-wide uppercase transition ${ativo ? 'text-tinta' : 'text-tinta/40 hover:text-tinta/70'}`}
    >
      <span
        className={`grid size-7 place-items-center rounded-full text-xs ${ativo ? 'bg-terracota text-linho' : 'border border-tinta/20'}`}
      >
        {n}
      </span>
      {rotulo}
    </button>
  )
  return (
    <div className="flex items-center gap-3">
      {passo(1, 'Tamanho do espaço', etapa === 'planta', () => irPara('planta'))}
      <span className="h-px w-6 shrink-0 bg-tinta/20" />
      {passo(2, 'Ambiente 3D', etapa === '3d', () => irPara('3d'))}
    </div>
  )
}

function Bloco({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-5 rounded-[20px] bg-linho p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-terracota">{titulo}</p>
        {extra}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

// --- Etapa 1 -----------------------------------------------------------------

function PainelPlanta({ ambiente, medidas }: { ambiente: Estado; medidas: Medidas }) {
  const { planta } = ambiente
  const mudarPeDireito = (d: number) =>
    definirPlanta({ ...planta, peDireito: Math.min(PE_DIREITO.max, Math.max(PE_DIREITO.min, planta.peDireito + d)) })

  return (
    <>
      <p className="mt-4 leading-relaxed font-medium text-pedra">
        Escolha um formato e ajuste do seu jeito: arraste as paredes e as bolinhas dos cantos, arredonde cantos e marque as
        portas.
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
          <Dica icone={<Porta />}>Toque numa parede para adicionar uma porta; arraste a porta para mudar de lugar</Dica>
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
        <Numero rotulo="Medidas">
          {metros(medidas.largura, 1)}×{metros(medidas.profundidade, 1)} <small className="text-sm">m</small>
        </Numero>
        <Numero rotulo="Portas">{planta.portas.length}</Numero>
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

// --- Etapa 2 -----------------------------------------------------------------

/** Seleção e situação dos móveis, compartilhadas entre a cena e o painel. */
let selecaoAtual: string | null = null
const ouvintesSelecao = new Set<(id: string | null) => void>()
const selecionar = (id: string | null) => {
  selecaoAtual = id
  ouvintesSelecao.forEach((fn) => fn(id))
}
function useSelecao() {
  const [id, setId] = useState(selecaoAtual)
  useEffect(() => {
    ouvintesSelecao.add(setId)
    return () => void ouvintesSelecao.delete(setId)
  }, [])
  return id
}

let situacoesAtuais: Record<string, Situacao> = {}
const ouvintesSituacao = new Set<(s: Record<string, Situacao>) => void>()
function useSituacoes() {
  const [s, setS] = useState(situacoesAtuais)
  useEffect(() => {
    ouvintesSituacao.add(setS)
    return () => void ouvintesSituacao.delete(setS)
  }, [])
  return s
}

const numero = (i: number) => String(i + 1).padStart(2, '0')

function PainelMoveis({ ambiente, medidas }: { ambiente: Estado; medidas: Medidas }) {
  const selecionado = useSelecao()
  const situacoes = useSituacoes()

  return (
    <>
      <p className="mt-3 text-xs font-bold tracking-wide text-pedra uppercase">
        {metros(medidas.largura)} × {metros(medidas.profundidade)} m · {formatarArea(medidas.area)} m² · pé-direito{' '}
        {metros(ambiente.planta.peDireito)} m
      </p>
      <button
        type="button"
        onClick={() => irPara('planta')}
        className="botao mt-5 w-full cursor-pointer border border-tinta/15 bg-linho hover:border-tinta"
      >
        <IconePlanta className="size-4 text-terracota" /> Editar planta
      </button>

      <PainelAcabamento acabamento={ambiente.acabamento} paredes={geometria(ambiente.planta.cantos).paredes} />

      <p className="eyebrow mt-7 text-terracota">{contarMoveis(ambiente.itens.length)}</p>
      {ambiente.itens.length === 0 ? (
        <p className="mt-4 rounded-[20px] border border-dashed border-tinta/20 p-5 text-sm leading-relaxed font-medium text-pedra">
          Nenhum móvel ainda. Escolha no catálogo e toque em “Adicionar ao ambiente”.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {ambiente.itens.map((item, i) => (
            <CartaoItem
              key={item.id}
              item={item}
              indice={i}
              aberto={item.id === selecionado}
              situacao={situacoes[item.id]}
            />
          ))}
        </ul>
      )}
    </>
  )
}

const elevar = (item: Item, cm: number) =>
  atualizarItem(item.id, { elevacao: Math.min(lerAmbiente().planta.peDireito, Math.max(0, (item.elevacao ?? 0) + cm)) })

const girar = (item: Item, graus: number) => atualizarItem(item.id, { giro: (((item.giro + graus) % 360) + 360) % 360 })

function CartaoItem({ item, indice, aberto, situacao }: { item: Item; indice: number; aberto: boolean; situacao?: Situacao }) {
  const movel = buscarMovel(item.slug)
  const ref = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (aberto) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [aberto])

  if (!movel) return null
  const cor = movel.cores[item.cor] ?? movel.cores[0]

  return (
    <li
      ref={ref}
      className={`overflow-hidden rounded-[20px] bg-linho transition ${aberto ? 'ring-2 ring-terracota' : 'ring-1 ring-tinta/5'}`}
    >
      <button
        type="button"
        onClick={() => selecionar(aberto ? null : item.id)}
        className="flex w-full cursor-pointer items-center gap-3 p-3 text-left"
      >
        <img src={cor.imagem ?? movel.imagem} alt="" className="size-14 shrink-0 rounded-xl bg-estudio object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl leading-tight">{movel.nome}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-pedra">
            Nº {numero(indice)}
            {situacao && (
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
          <div>
            <div className="flex items-center justify-between text-xs font-bold tracking-wide uppercase">
              <span className="text-pedra">Giro</span>
              <span className="text-terracota">{item.giro}°</span>
            </div>
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

          <div>
            <div className="flex items-center justify-between text-xs font-bold tracking-wide uppercase">
              <span className="text-pedra">Altura do chão</span>
              <span className="text-terracota">{item.elevacao ?? 0} cm</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <BotaoAcao onClick={() => elevar(item, -5)}>
                <Menos /> 5 cm
              </BotaoAcao>
              <BotaoAcao onClick={() => elevar(item, 5)}>
                <Mais /> 5 cm
              </BotaoAcao>
              <BotaoAcao onClick={() => atualizarItem(item.id, { elevacao: 0 })}>No chão</BotaoAcao>
            </div>
            {movel.categoria === 'Decoração' && (
              <p className="mt-2 text-xs font-medium text-pedra">Dica: arraste a peça para cima de uma mesa para apoiá-la nela.</p>
            )}
          </div>

          {movel.cores.length > 1 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold tracking-wide uppercase">
                <span className="text-pedra">Cor</span>
                <span className="text-terracota">{cor.nome}</span>
              </div>
              <div className="mt-3">
                <SeletorCores
                  cores={movel.cores}
                  selecionada={item.cor}
                  onSelecionar={(c) => atualizarItem(item.id, { cor: c })}
                  tamanho="g"
                />
              </div>
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
        </div>
      )}
    </li>
  )
}

function BotaoAcao({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="botao cursor-pointer border border-tinta/15 px-3 py-2.5 text-xs hover:border-tinta hover:bg-white"
    >
      {children}
    </button>
  )
}

function Cena3D({ ambiente }: { ambiente: Estado }) {
  const container = useRef<HTMLDivElement>(null)
  const rotulo = useRef<HTMLDivElement>(null)
  const cena = useRef<CenaAmbiente | null>(null)
  const [modo, setModo] = useState<Modo>('3d')
  const [areaUso, setAreaUso] = useState(true)
  const selecionado = useSelecao()

  useEffect(() => {
    const c = new CenaAmbiente(container.current!, rotulo.current, {
      aoSelecionar: selecionar,
      aoMover: (mudancas) => atualizarItens(mudancas),
      aoPosicionar: (id, x, y) => atualizarItem(id, { x, y }, false),
      aoSituacoes: (s) => {
        situacoesAtuais = s
        ouvintesSituacao.forEach((fn) => fn(s))
      },
      aoTocarParede: (parede) => {
        if (lerAmbiente().acabamento.porParede) definirPintura({ aberto: true, aba: 'paredes', parede })
      },
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

  const pintura = usePintura()
  const destaque = pintura.aberto && pintura.aba === 'paredes' && ambiente.acabamento.porParede ? pintura.parede : null
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

  const indice = ambiente.itens.findIndex((i) => i.id === selecionado)
  const item = ambiente.itens[indice]
  const movel = item && buscarMovel(item.slug)

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-estudio">
      <div ref={container} className="absolute inset-0" />

      <div
        ref={rotulo}
        className="pointer-events-none absolute top-0 left-0 rounded-full bg-tinta/85 px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-linho shadow-lg backdrop-blur"
        style={{ visibility: 'hidden' }}
      >
        {movel && `Nº ${numero(indice)} · ${movel.nome}`}
      </div>

      <ul className="pointer-events-none absolute top-4 left-4 hidden space-y-1.5 rounded-[18px] bg-linho/90 px-4 py-3 text-[11px] font-bold shadow-sm backdrop-blur sm:block">
        {(Object.keys(rotulosSituacao) as Situacao[]).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: coresSituacao[s] }} />
            {rotulosSituacao[s]}
          </li>
        ))}
      </ul>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-full bg-linho/90 p-1 shadow-sm backdrop-blur">
          <BotaoBarra disabled={!podeDesfazer('3d')} onClick={() => desfazer('3d')} rotulo="Desfazer">
            <Desfazer />
          </BotaoBarra>
          <span className="h-5 w-px bg-tinta/10" />
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

      {ambiente.itens.length === 0 && (
        <div className="absolute inset-x-4 top-1/2 mx-auto max-w-sm -translate-y-1/2 rounded-[24px] bg-linho/95 p-6 text-center shadow-xl backdrop-blur animar-surgir">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-creme text-terracota">
            <Check className="size-6" />
          </span>
          <p className="mt-4 font-display text-[28px] leading-tight">Seu cômodo está pronto</p>
          <p className="mt-2 text-sm font-medium text-pedra">
            Agora escolha os móveis no catálogo e toque em “Adicionar ao ambiente” para ver como ficam aqui.
          </p>
          <a href={hrefSecao('catalogo')} className="botao mt-5 w-full bg-musgo text-linho hover:bg-musgo-escuro">
            <Mais /> Escolher móveis
          </a>
        </div>
      )}

      {item && movel ? (
        <div className="absolute inset-x-4 bottom-4 mx-auto flex max-w-fit items-center gap-1.5 rounded-full bg-linho p-1.5 shadow-xl animar-surgir">
          <span className="hidden max-w-48 truncate px-3 font-display text-lg sm:block">{movel.nome}</span>
          <BotaoFlutuante onClick={() => girar(item, 90)}>
            <Girar /> Girar
          </BotaoFlutuante>
          <BotaoFlutuante onClick={() => selecionar(duplicarItem(item.id) ?? null)}>
            <Duplicar /> Duplicar
          </BotaoFlutuante>
          <BotaoFlutuante
            escuro
            onClick={() => {
              removerItem(item.id)
              selecionar(null)
            }}
          >
            <Lixeira /> Remover
          </BotaoFlutuante>
        </div>
      ) : (
        ambiente.itens.length > 0 && (
          <p className="pointer-events-none absolute inset-x-4 bottom-4 mx-auto w-fit max-w-full truncate rounded-full bg-linho/90 px-4 py-2 text-xs font-bold shadow-sm backdrop-blur">
            {modo === '3d'
              ? 'Arraste os móveis · arraste o fundo para girar · pinça para zoom'
              : 'Arraste os móveis · arraste o fundo para mover · pinça para zoom'}
          </p>
        )
      )}
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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition enabled:cursor-pointer disabled:text-tinta/30 ${
        ativo ? 'bg-musgo text-linho' : 'enabled:hover:bg-creme'
      }`}
    >
      {children}
      <span className="hidden md:inline">{rotulo}</span>
    </button>
  )
}

function BotaoFlutuante({ escuro, onClick, children }: { escuro?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`botao cursor-pointer px-4 py-2.5 text-xs ${
        escuro ? 'bg-tinta text-linho hover:bg-tinta/85' : 'border border-tinta/15 hover:border-tinta'
      }`}
    >
      {children}
    </button>
  )
}

// --- Paredes e piso ----------------------------------------------------------

type Pintura = { aberto: boolean; aba: 'paredes' | 'piso'; parede: number }

/** Painel de acabamento, compartilhado com a cena: tocar numa parede no 3D abre o painel nela. */
let pinturaAtual: Pintura = { aberto: false, aba: 'paredes', parede: 0 }
const ouvintesPintura = new Set<(p: Pintura) => void>()
const definirPintura = (mudanca: Partial<Pintura>) => {
  pinturaAtual = { ...pinturaAtual, ...mudanca }
  ouvintesPintura.forEach((fn) => fn(pinturaAtual))
}
function usePintura() {
  const [p, setP] = useState(pinturaAtual)
  useEffect(() => {
    ouvintesPintura.add(setP)
    return () => void ouvintesPintura.delete(setP)
  }, [])
  return p
}

function PainelAcabamento({ acabamento, paredes }: { acabamento: Acabamento; paredes: Geometria['paredes'] }) {
  const { aberto, aba, parede } = usePintura()
  const porParede = acabamento.porParede
  const tipo = pisos.find((p) => p.id === acabamento.piso)!
  const paredeAtual = Math.min(parede, paredes.length - 1)
  const corAtual = porParede ? corDaParede(acabamento, paredeAtual) : acabamento.paredes

  const pintar = (hex: string, desfazivel = true) =>
    definirAcabamento(porParede ? { porParede: { ...porParede, [paredeAtual]: hex } } : { paredes: hex }, desfazivel)

  return (
    <div className="mt-3 overflow-hidden rounded-[20px] bg-linho ring-1 ring-tinta/5">
      <button
        type="button"
        onClick={() => definirPintura({ aberto: !aberto })}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-creme text-terracota">
          <Paleta className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl leading-tight">Paredes e piso</span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-pedra">
            {porParede ? 'Uma cor por parede' : nomeDaCor(coresParede, acabamento.paredes)} · {tipo.rotulo}{' '}
            {nomeDaCor(tipo.cores, acabamento.corPiso).toLowerCase()}
          </span>
        </span>
        <span className="flex shrink-0 -space-x-2">
          <span className="size-7 rounded-full ring-2 ring-linho" style={{ backgroundColor: acabamento.paredes }} />
          <img src={miniaturaPiso(acabamento.piso, acabamento.corPiso)} alt="" className="size-7 rounded-full ring-2 ring-linho" />
        </span>
        <Mais className={`size-4 shrink-0 text-pedra transition ${aberto ? 'rotate-45' : ''}`} />
      </button>

      {aberto && (
        <div className="space-y-5 border-t border-tinta/10 p-4">
          <Abas
            opcoes={[
              ['paredes', 'Paredes'],
              ['piso', 'Piso'],
            ]}
            atual={aba}
            onEscolher={(a) => definirPintura({ aba: a })}
          />

          {aba === 'paredes' ? (
            <>
              <Abas
                opcoes={[
                  ['todas', 'Todas iguais'],
                  ['cada', 'Uma cor por parede'],
                ]}
                atual={porParede ? 'cada' : 'todas'}
                onEscolher={(modo) => {
                  if (modo === 'todas') definirAcabamento({ porParede: null })
                  else if (!porParede) {
                    definirAcabamento({ porParede: {} })
                    definirPintura({ parede: 0 })
                  }
                }}
                claro
              />

              {porParede && (
                <div>
                  <Rotulo titulo="Parede" valor="ou toque nela no 3D" />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {paredes.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => definirPintura({ parede: i })}
                        className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition ${
                          i === paredeAtual ? 'border-terracota bg-terracota/10' : 'border-tinta/10 hover:border-tinta/40'
                        }`}
                      >
                        <span
                          className="size-4 shrink-0 rounded-full ring-1 ring-tinta/15"
                          style={{ backgroundColor: corDaParede(acabamento, i) }}
                        />
                        <span className="min-w-0 leading-tight">
                          <span className="block text-xs font-bold">Parede {i + 1}</span>
                          <span className="block text-[10px] font-semibold text-pedra">{metros(p.comprimento, 1)} m</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Rotulo
                  titulo={porParede ? `Cor da parede ${paredeAtual + 1}` : 'Cor das paredes'}
                  valor={nomeDaCor(coresParede, corAtual)}
                />
                <Amostras opcoes={coresParede} atual={corAtual} onEscolher={pintar} />
              </div>
            </>
          ) : (
            <>
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
                      className={`cursor-pointer overflow-hidden rounded-2xl border text-left transition ${
                        ativo ? 'border-terracota ring-1 ring-terracota' : 'border-tinta/10 hover:border-tinta/40'
                      }`}
                    >
                      <img
                        src={miniaturaPiso(p.id, ativo ? acabamento.corPiso : p.cores[0].hex)}
                        alt=""
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <span className="block truncate px-2 py-1.5 text-[11px] font-bold">{p.rotulo}</span>
                    </button>
                  )
                })}
              </div>
              <div>
                <Rotulo titulo="Cor do piso" valor={nomeDaCor(tipo.cores, acabamento.corPiso)} />
                <Amostras
                  opcoes={tipo.cores}
                  atual={acabamento.corPiso}
                  onEscolher={(hex, desfazivel) => definirAcabamento({ corPiso: hex }, desfazivel)}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

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
    <div className={`grid grid-cols-2 gap-1 rounded-full p-1 ${claro ? 'border border-tinta/10' : 'bg-creme'}`}>
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

/** Cores prontas e uma cor livre (seletor do sistema). */
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
          key={c.hex}
          type="button"
          title={c.nome}
          aria-label={c.nome}
          onClick={() => onEscolher(c.hex)}
          className={`size-9 cursor-pointer rounded-full border-2 border-linho transition ${
            c.hex === atual ? 'scale-110 ring-[1.5px] ring-tinta' : 'ring-1 ring-tinta/15 hover:ring-tinta/50'
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
      <label
        title="Escolher outra cor"
        className={`relative size-9 cursor-pointer rounded-full border-2 border-linho transition ${
          livre ? 'scale-110 ring-[1.5px] ring-tinta' : 'ring-1 ring-tinta/15 hover:ring-tinta/50'
        }`}
        style={{
          background: livre ? atual : 'conic-gradient(#e0533d, #e8b33a, #6fbf5a, #3aa3c9, #6a5fd1, #c94f9b, #e0533d)',
        }}
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
