import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { coresParede, definirAcabamento, papeis, pisos, type Acabamento, type OpcaoCor } from '../lib/ambiente'
import {
  abrirQuickLook,
  ProvadorXR,
  suporteRA,
  type EstadoRA,
  type Superficie,
  type SuporteRA,
} from '../lib/raAcabamento'
import { cameraDisponivel, pedirGiroscopio, ProvadorCamera, TOLERANCIA_PADRAO, type EstadoCamera } from '../lib/raCamera'
import { miniaturaPapel } from '../lib/texturasParede'
import { miniaturaPiso } from '../lib/texturasPiso'
import { Camera, Desfazer, Fechar, Lixeira, Olho, Paleta } from './Icones'
import { parametrosConvite } from '../lib/conviteRA'
import { ModalQR } from './ModalQR'

type Props = {
  acabamento: Acabamento
  /** Pé-direito, em cm. */
  peDireito: number
  /** Superfície que a RA abre mostrando (o catálogo de paredes abre na parede). */
  modoInicial?: Superficie
  /** Texto do botão, quando não é o padrão. */
  rotulo?: string
}

const nomeDaCor = (opcoes: OpcaoCor[], hex: string) => opcoes.find((c) => c.hex === hex)?.nome ?? 'Personalizada'

const descrever = (modo: Superficie, a: Acabamento) => {
  if (modo === 'piso') {
    const tipo = pisos.find((p) => p.id === a.piso)!
    return `${tipo.rotulo} · ${nomeDaCor(tipo.cores, a.corPiso)}`
  }
  return `${papeis.find((p) => p.id === a.papel)!.rotulo} · ${nomeDaCor(coresParede, a.paredes)}`
}

/** Celular ou tablet (tela de toque), onde a câmera faz sentido. */
const celular = () => matchMedia('(pointer: coarse)').matches

/**
 * Botão "provar no meu espaço": RA no Android com ARCore; nos outros celulares (iPhone incluído), a
 * câmera ao vivo com a rede que acha parede e chão; QR code no computador.
 */
export function ProvadorRA({ acabamento, peDireito, modoInicial = 'piso', rotulo = 'Provar piso e parede no meu espaço' }: Props) {
  const [suporte, setSuporte] = useState<SuporteRA | undefined>()
  const [aberto, setAberto] = useState<'xr' | 'camera' | 'ios' | 'qr' | null>(null)
  const [giroscopio, setGiroscopio] = useState<Promise<boolean>>(() => Promise.resolve(false))
  const [modo, setModo] = useState<Superficie>(modoInicial)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState<EstadoRA>(inicial)
  const sessao = useRef<ProvadorXR | null>(null)
  const overlay = useRef<HTMLDivElement>(null)

  useEffect(() => {
    suporteRA().then(setSuporte)
  }, [])

  useEffect(() => {
    sessao.current?.definirAcabamento(acabamento)
  }, [acabamento])

  useEffect(() => {
    sessao.current?.definirModo(modo)
  }, [modo])

  useEffect(() => () => sessao.current?.encerrar(), [])

  const abrir = () => {
    setErro('')
    if (suporte !== 'webxr') {
      if (cameraDisponivel() && celular()) {
        // Pedido dentro do toque: o iPhone só libera o giroscópio assim.
        setGiroscopio(pedirGiroscopio())
        return setAberto('camera')
      }
      return setAberto(suporte === 'quicklook' ? 'ios' : 'qr')
    }
    // O overlay precisa estar na tela antes de pedir a sessão, que só pode ser pedida dentro do toque.
    flushSync(() => {
      setEstado(inicial)
      setAberto('xr')
    })
    const s = new ProvadorXR(overlay.current!, acabamento, peDireito / 100, {
      aoEstado: setEstado,
      aoEncerrar: () => {
        sessao.current = null
        setAberto(null)
      },
    })
    s.definirModo(modo)
    sessao.current = s
    s.iniciar().catch(() => {
      s.encerrar()
      sessao.current = null
      setAberto(null)
      setErro('Não foi possível abrir a câmera. Confira a permissão do navegador e tente de novo.')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={suporte === undefined}
        className="botao mt-3 w-full cursor-pointer bg-terracota py-4 text-linho hover:bg-terracota-escuro disabled:opacity-60"
      >
        <Camera className="size-4" /> {rotulo}
      </button>
      <p className="mt-2 text-center text-xs font-medium text-pedra">
        {erro ||
          (suporte === null && !(cameraDisponivel() && celular())
            ? 'Realidade aumentada: abra no celular pelo QR code.'
            : 'Realidade aumentada: aponte o celular para o chão ou a parede.')}
      </p>

      {/* No body: um pai com animação (transform) prenderia o "fixed" dentro dele. */}
      {createPortal(
        <>
          <div ref={overlay} className={aberto === 'xr' ? 'fixed inset-0 z-[80] text-tinta select-none' : 'hidden'}>
            {aberto === 'xr' && (
              <InterfaceRA
                sessao={sessao}
                overlay={overlay}
                estado={estado}
                modo={modo}
                setModo={setModo}
                acabamento={acabamento}
              />
            )}
          </div>

          {aberto === 'camera' && (
            <PainelCamera
              acabamento={acabamento}
              modo={modo}
              setModo={setModo}
              giroscopio={giroscopio}
              aoAmostra={suporte === 'quicklook' ? () => setAberto('ios') : undefined}
              aoFechar={() => setAberto(null)}
            />
          )}

          {aberto === 'ios' && (
            <PainelQuickLook
              modo={modo}
              setModo={setModo}
              acabamento={acabamento}
              peDireito={peDireito}
              aoFechar={() => setAberto(null)}
            />
          )}

          {aberto === 'qr' && (
            <ModalQR
              texto={`Aponte a câmera para o QR code: o celular abre já com ${
                modo === 'piso' ? 'este piso' : 'esta parede'
              } (${descrever(modo, acabamento)}), pronto para ver no seu cômodo.`}
              parametros={parametrosConvite({
                tipo: modo,
                piso: acabamento.piso,
                corPiso: acabamento.corPiso,
                papel: acabamento.papel,
                paredes: acabamento.paredes,
              })}
              aoFechar={() => setAberto(null)}
            />
          )}
        </>,
        document.body,
      )}
    </>
  )
}

// --- Dentro da RA (Android) ------------------------------------------------------------

function mensagem(modo: Superficie, e: EstadoRA): string {
  if (e.alvo === 'procurando') return 'Mova o celular devagar, apontando para o chão'
  if (e.alvo === 'movel') return 'Isso parece um móvel. Aponte para o chão livre'
  if (modo === 'piso')
    return e.piso
      ? 'Use dois dedos para aumentar o piso · toque em outro ponto para mudar de lugar'
      : 'Mire no chão e toque para colocar o piso'
  if (e.fechado) return 'Pronto! Troque o revestimento e a cor aqui embaixo'
  if (e.alvo === 'fechar') return 'Toque para fechar as paredes'
  if (e.cantos === 0) return 'Mire no pé da parede, num canto, e toque para marcar'
  if (e.cantos === 1) return 'Toque no outro canto da parede'
  return 'Toque no próximo canto para continuar a parede'
}

const inicial: EstadoRA = { alvo: 'procurando', cantos: 0, fechado: false, piso: false, lado: 2.5, oclusao: false }

type PropsInterface = {
  sessao: RefObject<ProvadorXR | null>
  overlay: RefObject<HTMLDivElement | null>
  estado: EstadoRA
  modo: Superficie
  setModo: (m: Superficie) => void
  acabamento: Acabamento
}

function InterfaceRA({ sessao, overlay, estado, modo, setModo, acabamento }: PropsInterface) {
  const total = estado.cantos + (estado.piso ? 1 : 0)
  const [aberta, setAberta] = useState(false)

  // Toques nos painéis não aplicam piso/parede: só os toques "na cena".
  useEffect(() => {
    const el = overlay.current
    const bloquear = (e: Event) => {
      if ((e.target as Element).closest?.('[data-ui]')) e.preventDefault()
    }
    el?.addEventListener('beforexrselect', bloquear)
    return () => el?.removeEventListener('beforexrselect', bloquear)
  }, [overlay])

  return (
    <>
      <Topo rotuloFechar="Sair da realidade aumentada" aoFechar={() => sessao.current?.encerrar()}>
        <p className="line-clamp-2 text-[13px] leading-snug font-semibold">
          {mensagem(modo, estado)}
          {modo === 'parede' && estado.cantos > 0 && (
            <span className="font-medium text-pedra">
              {' '}
              · {estado.cantos} {estado.cantos === 1 ? 'canto' : 'cantos'}
            </span>
          )}
        </p>
        {modo === 'parede' && estado.cantos >= 3 && !estado.fechado && (
          <button
            type="button"
            onClick={() => sessao.current?.fechar()}
            className="mt-1.5 cursor-pointer rounded-full bg-musgo px-3 py-1.5 text-xs font-bold text-linho"
          >
            Fechar as paredes aqui
          </button>
        )}
      </Topo>

      {estado.alvo === 'procurando' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="size-24 animate-ping rounded-full border-2 border-linho/80" />
        </div>
      )}

      <Gaveta
        modo={modo}
        setModo={setModo}
        acabamento={acabamento}
        aberta={aberta}
        setAberta={setAberta}
        acoes={
          <>
            <BotaoRedondo
              rotulo="Segure para ver o original"
              disabled={!total}
              onPointerDown={() => sessao.current?.mostrar(false)}
              onPointerUp={() => sessao.current?.mostrar(true)}
            >
              <Olho className="size-5" />
            </BotaoRedondo>
            <BotaoRedondo rotulo="Desfazer" disabled={!total} onClick={() => sessao.current?.desfazer()}>
              <Desfazer className="size-5" />
            </BotaoRedondo>
            <BotaoRedondo rotulo="Limpar tudo" disabled={!total} onClick={() => sessao.current?.limpar()}>
              <Lixeira className="size-5" />
            </BotaoRedondo>
          </>
        }
      >
        {modo === 'piso' && estado.piso && (
          <div className="flex items-center justify-between gap-3 rounded-full bg-creme p-1">
            <BotaoRedondo rotulo="Diminuir o piso" onClick={() => sessao.current?.redimensionar(1 / 1.25)}>
              <span className="text-xl leading-none font-bold">−</span>
            </BotaoRedondo>
            <p className="text-center text-xs font-bold">
              Piso de {estado.lado.toLocaleString('pt-BR')} × {estado.lado.toLocaleString('pt-BR')} m
              <span className="block text-[10px] font-semibold text-pedra">ou use dois dedos na tela</span>
            </p>
            <BotaoRedondo rotulo="Aumentar o piso" onClick={() => sessao.current?.redimensionar(1.25)}>
              <span className="text-xl leading-none font-bold">+</span>
            </BotaoRedondo>
          </div>
        )}
        {estado.oclusao && (estado.piso || estado.cantos > 1) && (
          <p className="text-[11px] font-semibold text-musgo">Os móveis ficam por cima do piso</p>
        )}
      </Gaveta>
    </>
  )
}

// --- Peças da tela da câmera (RA e câmera ao vivo) ---------------------------------------

/** Topo enxuto: fechar e uma linha (ou duas) de instrução, para a imagem ficar livre. */
function Topo({ rotuloFechar, aoFechar, children }: { rotuloFechar: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <div
      data-ui
      className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-start gap-2 sm:right-auto sm:w-[26rem]"
    >
      <button
        type="button"
        onClick={aoFechar}
        aria-label={rotuloFechar}
        className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-linho/90 shadow-lg backdrop-blur-md"
      >
        <Fechar className="size-5" />
      </button>
      <div className="min-w-0 flex-1 rounded-2xl bg-linho/85 px-3 py-2 shadow-lg backdrop-blur-md">{children}</div>
    </div>
  )
}

type PropsGaveta = {
  modo: Superficie
  setModo: (m: Superficie) => void
  acabamento: Acabamento
  /** Botões redondos da barra (sempre à vista). */
  acoes: ReactNode
  /** Gaveta de ajustes (cores e o que vier em `children`) aberta. */
  aberta: boolean
  setAberta: (v: boolean) => void
  /** Extras da gaveta aberta, abaixo das cores. */
  children?: ReactNode
}

/**
 * Embaixo: a trilha de acabamentos (sempre à vista: um toque troca na hora) e a barra com piso/parede,
 * as ações e o botão das cores e ajustes. A gaveta de ajustes abre por cima da trilha; fechada, quase
 * toda a tela fica para a câmera.
 */
function Gaveta({ modo, setModo, acabamento, acoes, aberta, setAberta, children }: PropsGaveta) {
  return (
    <div
      data-ui
      className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] rounded-[24px] bg-linho/90 p-1.5 shadow-xl backdrop-blur-md sm:inset-x-auto sm:right-3 sm:w-[26rem]"
    >
      {aberta && (
        <div className="max-h-[min(40dvh,20rem)] space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-2 pb-3">
          <p className="truncate text-[11px] font-bold tracking-wide text-terracota uppercase">
            {modo === 'piso' ? 'Piso' : 'Parede'} · {descrever(modo, acabamento)}
          </p>
          <LinhaCores modo={modo} acabamento={acabamento} />
          {children}
        </div>
      )}
      <TrilhaTipos modo={modo} acabamento={acabamento} aoTocarAtivo={() => setAberta(true)} />
      <div className="mt-1 flex items-center gap-1">
        <AbasSuperficie modo={modo} setModo={setModo} />
        {acoes}
        <button
          type="button"
          onClick={() => setAberta(!aberta)}
          aria-expanded={aberta}
          aria-label={aberta ? 'Fechar cores e ajustes' : 'Cores e ajustes'}
          title={aberta ? 'Fechar' : 'Cores e ajustes'}
          className={`grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border transition ${
            aberta ? 'border-terracota bg-terracota text-linho' : 'border-tinta/15'
          }`}
        >
          {aberta ? <Fechar className="size-5" /> : <Paleta className="size-5" />}
        </button>
      </div>
    </div>
  )
}

type PropsBotao = {
  rotulo: string
  disabled?: boolean
  onClick?: () => void
  onPointerDown?: () => void
  onPointerUp?: () => void
  children: ReactNode
}

function BotaoRedondo({ rotulo, disabled, onClick, onPointerDown, onPointerUp, children }: PropsBotao) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className="grid size-10 shrink-0 touch-none place-items-center rounded-full border border-tinta/15 transition enabled:cursor-pointer enabled:active:scale-90 enabled:active:bg-creme disabled:opacity-35"
    >
      {children}
    </button>
  )
}

function AbasSuperficie({ modo, setModo }: { modo: Superficie; setModo: (m: Superficie) => void }) {
  const opcoes: [Superficie, string][] = [
    ['piso', 'Piso'],
    ['parede', 'Parede'],
  ]
  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-0.5 rounded-full bg-creme p-1">
      {opcoes.map(([v, rotulo]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === modo}
          onClick={() => setModo(v)}
          className={`min-w-0 cursor-pointer truncate rounded-full px-2 py-2 text-xs font-bold transition ${
            v === modo ? 'bg-musgo text-linho' : 'text-pedra'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  )
}

/** Os tipos de piso (ou de revestimento de parede), com a miniatura na cor de cada um. */
function tiposDe(modo: Superficie, a: Acabamento) {
  return modo === 'piso'
    ? pisos.map((p) => ({
        id: p.id,
        rotulo: p.rotulo,
        ativo: p.id === a.piso,
        imagem: miniaturaPiso(p.id, p.id === a.piso ? a.corPiso : p.cores[0].hex),
        escolher: () =>
          definirAcabamento({
            piso: p.id,
            corPiso: p.cores.some((c) => c.hex === a.corPiso) ? a.corPiso : p.cores[0].hex,
          }),
      }))
    : papeis.map((p) => ({
        id: p.id,
        rotulo: p.rotulo,
        ativo: p.id === a.papel,
        imagem: miniaturaPapel(p.id, a.paredes),
        escolher: () => definirAcabamento({ papel: p.id }),
      }))
}

/**
 * Trilha compacta dos acabamentos, sempre à vista: um toque troca na hora. Tocar no que já está
 * escolhido abre as cores dele. O escolhido fica sempre à vista na trilha.
 */
function TrilhaTipos({ modo, acabamento, aoTocarAtivo }: { modo: Superficie; acabamento: Acabamento; aoTocarAtivo: () => void }) {
  const ativo = useRef<HTMLButtonElement>(null)
  const tipos = tiposDe(modo, acabamento)
  const idAtivo = tipos.find((t) => t.ativo)?.id

  useEffect(() => {
    ativo.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [modo, idAtivo])

  return (
    <div className="flex gap-1 overflow-x-auto px-1 pt-0.5 pb-1 [scrollbar-width:none]">
      {tipos.map((t) => (
        <button
          key={t.id}
          ref={t.ativo ? ativo : undefined}
          type="button"
          aria-pressed={t.ativo}
          title={t.ativo ? `${t.rotulo}: tocar de novo abre as cores` : t.rotulo}
          onClick={() => (t.ativo ? aoTocarAtivo() : t.escolher())}
          className="w-[3.75rem] shrink-0 cursor-pointer rounded-xl p-1 text-center transition active:scale-95"
        >
          <img
            src={t.imagem}
            alt=""
            className={`mx-auto size-11 rounded-xl object-cover transition ${
              t.ativo ? 'ring-2 ring-terracota ring-offset-2 ring-offset-linho' : 'ring-1 ring-tinta/10'
            }`}
          />
          <span className={`mt-1 block truncate text-[9px] font-bold ${t.ativo ? 'text-terracota' : 'text-pedra'}`}>
            {t.rotulo}
          </span>
        </button>
      ))}
    </div>
  )
}

/** As cores do acabamento escolhido. */
function LinhaCores({ modo, acabamento: a }: { modo: Superficie; acabamento: Acabamento }) {
  const cores = modo === 'piso' ? pisos.find((p) => p.id === a.piso)!.cores : coresParede
  const corAtual = modo === 'piso' ? a.corPiso : a.paredes
  return (
    <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 py-1 [scrollbar-width:none]">
      {cores.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.nome}
          aria-label={c.nome}
          aria-pressed={c.hex === corAtual}
          onClick={() => definirAcabamento(modo === 'piso' ? { corPiso: c.hex } : { paredes: c.hex })}
          className={`size-9 shrink-0 cursor-pointer rounded-full border-2 border-linho transition ${
            c.hex === corAtual ? 'scale-110 ring-[1.5px] ring-tinta' : 'ring-1 ring-tinta/15'
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  )
}

/** Tipos (com nome) e cores, em tamanho maior: o painel do iPhone, fora da câmera. */
function SeletorAcabamento({ modo, acabamento: a }: { modo: Superficie; acabamento: Acabamento }) {
  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {tiposDe(modo, a).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => !t.ativo && t.escolher()}
            className={`w-[76px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border text-left transition ${
              t.ativo ? 'border-terracota ring-1 ring-terracota' : 'border-tinta/10'
            }`}
          >
            <img src={t.imagem} alt="" className="aspect-square w-full object-cover" />
            <span className="block truncate px-2 py-1 text-[10px] font-bold">{t.rotulo}</span>
          </button>
        ))}
      </div>
      <div className="-mx-1">
        <LinhaCores modo={modo} acabamento={a} />
      </div>
    </div>
  )
}

// --- Câmera ao vivo (iPhone e Android sem ARCore) -----------------------------------------

type PropsCamera = {
  acabamento: Acabamento
  modo: Superficie
  setModo: (m: Superficie) => void
  giroscopio: Promise<boolean>
  /** iPhone: a amostra em tamanho real no Quick Look, como alternativa. */
  aoAmostra?: () => void
  aoFechar: () => void
}

function mensagemCamera(modo: Superficie, e: EstadoCamera) {
  if (e.etapa === 'erro') return 'Não foi possível abrir a câmera. Confira a permissão do navegador e tente de novo.'
  if (e.etapa === 'camera') return 'Abrindo a câmera…'
  if (!e[modo]) return modo === 'piso' ? 'Toque no chão para trocar o piso' : 'Toque na parede para trocar o revestimento'
  return 'Pronto! Troque o acabamento aqui embaixo. Faltou um pedaço? Toque nele'
}

const textoIA: Record<EstadoCamera['ia'], string> = {
  pronta: 'IA ligada: separa parede, piso e móveis',
  carregando: 'Carregando a IA…',
  indisponivel: 'Sem IA neste aparelho: só pela cor',
}

function PainelCamera({ acabamento, modo, setModo, giroscopio, aoAmostra, aoFechar }: PropsCamera) {
  const tela = useRef<HTMLDivElement>(null)
  const provador = useRef<ProvadorCamera | null>(null)
  const [estado, setEstado] = useState<EstadoCamera>({
    etapa: 'camera',
    ia: 'carregando',
    piso: 0,
    parede: 0,
    semGiroscopio: false,
  })
  const [foto, setFoto] = useState<string | null>(null)
  const [tolerancia, setTolerancia] = useState<Record<Superficie, number>>({
    piso: TOLERANCIA_PADRAO,
    parede: TOLERANCIA_PADRAO,
  })
  const [aberta, setAberta] = useState(false)
  /** Segurando o olho: a imagem original, sem nada trocado. */
  const [original, setOriginal] = useState(false)
  const [flash, setFlash] = useState(false)
  /** Anéis no lugar de cada toque, para a pessoa ver onde marcou. */
  const [toques, setToques] = useState<{ id: number; x: number; y: number }[]>([])
  const pontos = estado[modo]
  const escolhida = pontos > 0

  useEffect(() => {
    const p = new ProvadorCamera(tela.current!, acabamento, giroscopio, { aoEstado: setEstado })
    provador.current = p
    p.iniciar(modo)
    document.body.style.overflow = 'hidden'
    return () => {
      p.encerrar()
      provador.current = null
      document.body.style.overflow = ''
    }
    // Só ao abrir: acabamento e modo seguem pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => provador.current?.definirAcabamento(acabamento), [acabamento])
  useEffect(() => provador.current?.definirModo(modo), [modo])
  useEffect(() => () => void (foto && URL.revokeObjectURL(foto)), [foto])

  const tirarFoto = async () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 90)
    const blob = await provador.current?.capturar()
    if (!blob) return
    const arquivo = new File([blob], 'meu-ambiente.jpg', { type: 'image/jpeg' })
    if (navigator.canShare?.({ files: [arquivo] })) {
      navigator.share({ files: [arquivo], title: 'Meu ambiente' }).catch(() => {})
      return
    }
    setFoto(URL.createObjectURL(blob))
  }

  const carregando = estado.etapa !== 'pronto'

  /**
   * O toque na imagem ensina a cor da superfície (do modo atual) naquele ponto. Com a gaveta de ajustes
   * aberta, o toque só fecha a gaveta (não marca um ponto sem querer).
   */
  const tocar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (aberta) return setAberta(false)
    if (carregando) return
    const r = e.currentTarget.getBoundingClientRect()
    provador.current?.escolher((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    const id = performance.now()
    setToques((t) => [...t, { id, x: e.clientX - r.left, y: e.clientY - r.top }])
    setTimeout(() => setToques((t) => t.filter((v) => v.id !== id)), 700)
  }

  const mudarTolerancia = (t: number) => {
    setTolerancia((v) => ({ ...v, [modo]: t }))
    provador.current?.definirTolerancia(t)
  }

  const verOriginal = (v: boolean) => {
    setOriginal(v)
    provador.current?.mostrar(!v)
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black text-tinta select-none" role="dialog" aria-modal="true" aria-label="Provar com a câmera">
      <div ref={tela} className="absolute inset-0" onPointerUp={tocar} />

      {toques.map((t) => (
        <span
          key={t.id}
          className="pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-linho"
          style={{ left: t.x, top: t.y }}
        />
      ))}

      {estado.etapa === 'pronto' && !escolhida && !aberta && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="relative grid size-20 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-linho/80" />
            <span className="size-3 rounded-full bg-linho shadow" />
          </span>
        </div>
      )}

      {carregando && estado.etapa !== 'erro' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="size-16 animate-spin rounded-full border-4 border-linho/30 border-t-linho" />
        </div>
      )}

      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity ${flash ? 'opacity-80 duration-0' : 'opacity-0 duration-300'}`}
      />

      {original && (
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-tinta/75 px-4 py-2 text-sm font-bold text-linho backdrop-blur">
          Original
        </span>
      )}

      <Topo rotuloFechar="Fechar a câmera" aoFechar={aoFechar}>
        <p className="line-clamp-2 text-[13px] leading-snug font-semibold">{mensagemCamera(modo, estado)}</p>
        {estado.etapa === 'pronto' && (escolhida || estado.semGiroscopio) && (
          <p
            className={`mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-semibold ${
              estado.ia === 'indisponivel' ? 'text-terracota' : 'text-musgo'
            }`}
          >
            <span className={`size-1.5 shrink-0 rounded-full bg-current ${estado.ia === 'carregando' ? 'animate-pulse' : ''}`} />
            {escolhida ? textoIA[estado.ia] : 'Sem giroscópio: perspectiva aproximada'}
            {escolhida && pontos > 1 && <span className="text-pedra"> · {pontos} toques</span>}
          </p>
        )}
      </Topo>

      <Gaveta
        modo={modo}
        setModo={(m) => {
          setModo(m)
          setAberta(false)
        }}
        acabamento={acabamento}
        aberta={aberta}
        setAberta={setAberta}
        acoes={
          <>
            <BotaoRedondo
              rotulo="Segure para ver o original"
              disabled={carregando || !escolhida}
              onPointerDown={() => verOriginal(true)}
              onPointerUp={() => verOriginal(false)}
            >
              <Olho className="size-5" />
            </BotaoRedondo>
            <BotaoRedondo rotulo="Tirar foto" disabled={carregando} onClick={tirarFoto}>
              <Camera className="size-5" />
            </BotaoRedondo>
            <BotaoRedondo rotulo="Desfazer o último toque" disabled={!escolhida} onClick={() => provador.current?.desfazer()}>
              <Desfazer className="size-5" />
            </BotaoRedondo>
          </>
        }
      >
        {escolhida && (
          <div className="space-y-1">
            <label className="flex items-center gap-3 rounded-full bg-creme px-4 py-2">
              <span className="shrink-0 text-xs font-bold">Sensibilidade</span>
              <input
                type="range"
                min={0.15}
                max={1.3}
                step={0.01}
                value={tolerancia[modo]}
                onChange={(e) => mudarTolerancia(Number(e.target.value))}
                className="w-full accent-terracota"
                aria-label="Quanto a cor pode variar e ainda ser trocada"
              />
            </label>
            <p className="flex justify-between px-4 text-[10px] font-semibold text-pedra">
              <span>Pega menos (vazou?)</span>
              <span>Pega mais (faltou?)</span>
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {escolhida && (
            <button
              type="button"
              onClick={() => {
                provador.current?.limpar()
                setAberta(false)
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-creme px-3 py-1.5 text-xs font-bold"
            >
              <Lixeira className="size-3.5" /> Limpar {modo === 'piso' ? 'o piso' : 'a parede'}
            </button>
          )}
          {aoAmostra && (
            <button type="button" onClick={aoAmostra} className="cursor-pointer rounded-full bg-creme px-3 py-1.5 text-xs font-bold">
              Ver amostra em tamanho real
            </button>
          )}
        </div>
      </Gaveta>

      {foto && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-tinta/80 p-5" onClick={() => setFoto(null)}>
          <div className="w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <img src={foto} alt="Foto do ambiente com o piso e a parede novos" className="w-full rounded-2xl shadow-2xl" />
            <a href={foto} download="meu-ambiente.jpg" className="botao w-full bg-terracota py-3.5 text-linho">
              Salvar foto
            </a>
            <button type="button" onClick={() => setFoto(null)} className="botao w-full cursor-pointer bg-linho py-3.5">
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- iPhone (Quick Look) -----------------------------------------------------------------

type PropsQuickLook = {
  modo: Superficie
  setModo: (m: Superficie) => void
  acabamento: Acabamento
  peDireito: number
  aoFechar: () => void
}

const TAMANHOS_PISO = [2.5, 4, 6, 8]

function PainelQuickLook({ modo, setModo, acabamento, peDireito, aoFechar }: PropsQuickLook) {
  const [gerando, setGerando] = useState(false)
  const [lado, setLado] = useState(4)

  const ver = async () => {
    setGerando(true)
    try {
      await abrirQuickLook(modo, acabamento, peDireito / 100, lado)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid items-end bg-tinta/50 backdrop-blur-sm sm:place-items-center sm:p-5"
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Provar piso e parede no meu espaço"
    >
      <div
        className="relative w-full space-y-4 rounded-t-[28px] bg-linho p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animar-surgir sm:max-w-md sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="absolute top-4 right-4 grid size-10 cursor-pointer place-items-center rounded-full bg-creme"
        >
          <Fechar className="size-5" />
        </button>
        <div className="pr-12">
          <h2 className="text-[28px] leading-tight">Provar no meu espaço</h2>
          <p className="mt-1 text-sm font-semibold text-pedra">{descrever(modo, acabamento)}</p>
        </div>
        <AbasSuperficie modo={modo} setModo={setModo} />
        <SeletorAcabamento modo={modo} acabamento={acabamento} />
        {modo === 'piso' && (
          <div>
            <p className="text-xs font-bold">Tamanho do piso</p>
            <div className="mt-2 grid grid-cols-4 gap-1 rounded-full bg-creme p-1">
              {TAMANHOS_PISO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLado(t)}
                  className={`cursor-pointer rounded-full py-2 text-xs font-bold transition ${
                    t === lado ? 'bg-musgo text-linho' : 'text-pedra'
                  }`}
                >
                  {t.toLocaleString('pt-BR')} m
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-sm leading-relaxed text-pedra">
          {modo === 'piso'
            ? `Aponte a câmera para o chão: um piso de ${lado.toLocaleString('pt-BR')} × ${lado.toLocaleString('pt-BR')} m aparece em tamanho real. Arraste para mudar de lugar.`
            : `Aponte a câmera para a parede e toque no meio dela: uma amostra de 3 m de largura por ${(peDireito / 100).toLocaleString('pt-BR')} m de altura aparece em tamanho real.`}
        </p>
        <button
          type="button"
          onClick={ver}
          disabled={gerando}
          className="botao w-full cursor-pointer bg-terracota py-4 text-linho hover:bg-terracota-escuro disabled:opacity-60"
        >
          <Camera className="size-4" />{' '}
          {gerando ? 'Preparando…' : modo === 'piso' ? 'Ver o piso no chão' : 'Ver na minha parede'}
        </button>
      </div>
    </div>
  )
}
