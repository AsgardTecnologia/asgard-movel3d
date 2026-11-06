import { useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode } from 'react'
import {
  caixa,
  comprimento,
  desfazer,
  definirPlanta,
  alturaDaParede,
  geometria,
  JANELA_PADRAO,
  LARGURA_PORTA,
  limitarPorta,
  marcarDesfazer,
  novoIdPorta,
  podeDesfazer,
  pontoNaParede,
  RAIO_CANTO,
  soma,
  sub,
  escalar,
  type Canto,
  type Planta,
  type Ponto,
} from '../lib/ambiente'
import { Desfazer, Janela, Lixeira, Mais, Menos, Porta } from './Icones'

type Arraste =
  | { tipo: 'canto'; i: number }
  | { tipo: 'parede'; i: number }
  | { tipo: 'porta'; id: string }
  | { tipo: 'janela'; id: string }

/** O que um toque na parede coloca. */
type Ferramenta = 'porta' | 'janela'

type Gesto = Arraste & { inicio: Ponto; tela: Ponto; cantos: Canto[]; moveu: boolean }

const GRADE = 10
const ajustar = (v: number) => Math.round(v / GRADE) * GRADE
const MARGEM = 140

export function EditorPlanta({ planta }: { planta: Planta }) {
  const svg = useRef<SVGSVGElement>(null)
  const gesto = useRef<Gesto | null>(null)
  const [portaAtiva, setPortaAtiva] = useState<string | null>(null)
  const [ferramenta, setFerramenta] = useState<Ferramenta>('porta')
  const [tamanho, setTamanho] = useState({ l: 800, a: 600 })
  const geo = useMemo(() => geometria(planta.cantos), [planta.cantos])

  // A vista acompanha a planta, mas fica parada durante o arraste para a parede não "fugir" do dedo.
  const [vistaFixa, setVistaFixa] = useState<{ x: number; y: number; l: number; a: number } | null>(null)
  const vistaAjustada = useMemo(() => {
    const c = caixa(planta.cantos)
    return { x: c.x - MARGEM, y: c.y - MARGEM, l: c.largura + MARGEM * 2, a: c.altura + MARGEM * 2 }
  }, [planta.cantos])
  const vista = vistaFixa ?? vistaAjustada

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setTamanho({ l: e.contentRect.width, a: e.contentRect.height }))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Unidades da planta (cm) por pixel de tela, para alças e textos terem tamanho fixo.
  const px = Math.max(vista.l / tamanho.l, vista.a / tamanho.a)

  const paraPlanta = (e: { clientX: number; clientY: number }): Ponto => {
    const el = svg.current!
    const p = el.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const r = p.matrixTransform(el.getScreenCTM()!.inverse())
    return { x: r.x, y: r.y }
  }

  const comecar = (e: EventoPonteiro, arraste: Arraste) => {
    e.stopPropagation()
    svg.current?.setPointerCapture(e.pointerId)
    gesto.current = { ...arraste, inicio: paraPlanta(e), tela: { x: e.clientX, y: e.clientY }, cantos: planta.cantos, moveu: false }
  }

  const mover = (e: EventoPonteiro) => {
    const g = gesto.current
    if (!g) return
    if (!g.moveu) {
      if (Math.hypot(e.clientX - g.tela.x, e.clientY - g.tela.y) < 5) return
      g.moveu = true
      marcarDesfazer('planta')
      setVistaFixa(vista)
    }
    const p = paraPlanta(e)
    const delta = sub(p, g.inicio)

    if (g.tipo === 'canto') {
      const cantos = g.cantos.map((c, i) =>
        i === g.i ? { ...c, x: ajustar(c.x + delta.x), y: ajustar(c.y + delta.y) } : c,
      )
      definirPlanta({ ...planta, cantos }, false)
    } else if (g.tipo === 'parede') {
      const n = g.cantos.length
      const parede = geometria(g.cantos).paredes[g.i]
      const d = ajustar(delta.x * parede.normal.x + delta.y * parede.normal.y)
      const cantos = g.cantos.map((c, i) =>
        i === g.i || i === (g.i + 1) % n ? { ...c, ...soma(c, escalar(parede.normal, d)) } : c,
      )
      // Não deixa a parede atravessar a do outro lado.
      if (geometria(cantos).paredes.some((pa) => pa.comprimento < 30)) return
      definirPlanta({ ...planta, cantos }, false)
    } else {
      const lista = g.tipo === 'porta' ? planta.portas : planta.janelas
      const abertura = lista.find((pt) => pt.id === g.id)
      const parede = geo.paredes[abertura?.parede ?? -1]
      if (!abertura || !parede) return
      const ab = sub(parede.b, parede.a)
      const t = ((p.x - parede.a.x) * ab.x + (p.y - parede.a.y) * ab.y) / parede.comprimento ** 2
      const mover = <T extends { id: string; largura: number; t: number }>(itens: T[]) =>
        itens.map((pt) => (pt.id === abertura.id ? { ...pt, t: limitarPorta(parede, t, pt.largura) } : pt))
      definirPlanta(
        g.tipo === 'porta' ? { ...planta, portas: mover(planta.portas) } : { ...planta, janelas: mover(planta.janelas) },
        false,
      )
    }
  }

  const soltar = (e: EventoPonteiro) => {
    const g = gesto.current
    gesto.current = null
    setVistaFixa(null)
    if (!g || g.moveu) return

    // Toque sem arrastar: cada elemento tem a sua ação.
    if (g.tipo === 'canto') {
      const cantos = planta.cantos.map((c, i) => (i === g.i ? { ...c, raio: c.raio ? 0 : RAIO_CANTO } : c))
      definirPlanta({ ...planta, cantos })
    } else if (g.tipo === 'parede') {
      const parede = geo.paredes[g.i]
      const largura = ferramenta === 'porta' ? LARGURA_PORTA : JANELA_PADRAO.largura
      if (comprimento(sub(parede.fim, parede.inicio)) < largura + 10 || alturaDaParede(planta, g.i) < 1) return
      const p = paraPlanta(e)
      const ab = sub(parede.b, parede.a)
      const t = limitarPorta(parede, ((p.x - parede.a.x) * ab.x + (p.y - parede.a.y) * ab.y) / parede.comprimento ** 2, largura)
      const id = novoIdPorta()
      if (ferramenta === 'porta') definirPlanta({ ...planta, portas: [...planta.portas, { id, parede: g.i, t, largura }] })
      else definirPlanta({ ...planta, janelas: [...planta.janelas, { id, parede: g.i, t, ...JANELA_PADRAO }] })
      setPortaAtiva(id)
    } else {
      setPortaAtiva(g.id)
    }
  }

  const porta = planta.portas.find((p) => p.id === portaAtiva)
  const janela = planta.janelas.find((p) => p.id === portaAtiva)
  const ativa = porta ?? janela
  const mudarLargura = (largura: number) => {
    if (!ativa) return
    const parede = geo.paredes[ativa.parede]
    const nova = Math.max(porta ? 60 : 40, Math.min(porta ? 240 : 600, largura))
    if (comprimento(sub(parede.fim, parede.inicio)) < nova) return
    const ajustar = <T extends { id: string; largura: number; t: number }>(itens: T[]) =>
      itens.map((p) => (p.id === ativa.id ? { ...p, largura: nova, t: limitarPorta(parede, p.t, nova) } : p))
    definirPlanta(porta ? { ...planta, portas: ajustar(planta.portas) } : { ...planta, janelas: ajustar(planta.janelas) })
  }
  const removerAtiva = () => {
    definirPlanta({
      ...planta,
      portas: planta.portas.filter((p) => p.id !== portaAtiva),
      janelas: planta.janelas.filter((p) => p.id !== portaAtiva),
    })
    setPortaAtiva(null)
  }

  const parede = 7 * px
  const contorno = geo.contorno.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-estudio">
      <svg
        ref={svg}
        viewBox={`${vista.x} ${vista.y} ${vista.l} ${vista.a}`}
        className="h-full w-full touch-none select-none"
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onPointerDown={() => setPortaAtiva(null)}
      >
        <defs>
          <pattern id="grade-menor" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="#1c1e1a" strokeOpacity="0.06" strokeWidth={px} />
          </pattern>
          <pattern id="grade" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#grade-menor)" />
            <path d="M100 0H0V100" fill="none" stroke="#1c1e1a" strokeOpacity="0.1" strokeWidth={px} />
          </pattern>
        </defs>
        <rect x={vista.x - 5000} y={vista.y - 5000} width={vista.l + 10000} height={vista.a + 10000} fill="url(#grade)" />

        <polygon points={contorno} fill="var(--color-terracota)" fillOpacity="0.1" />
        <polygon points={contorno} fill="none" stroke="var(--color-tinta)" strokeWidth={parede} strokeLinejoin="round" />
        {geo.paredes.map((p, i) =>
          alturaDaParede(planta, i) < 1 ? (
            <g key={`ab${i}`} className="pointer-events-none">
              <line x1={p.inicio.x} y1={p.inicio.y} x2={p.fim.x} y2={p.fim.y} stroke="var(--color-estudio)" strokeWidth={parede + 2 * px} />
              <line
                x1={p.inicio.x}
                y1={p.inicio.y}
                x2={p.fim.x}
                y2={p.fim.y}
                stroke="var(--color-tinta)"
                strokeWidth={2 * px}
                strokeDasharray={`${8 * px} ${6 * px}`}
              />
            </g>
          ) : null,
        )}

        {/* Medidas de cada parede, do lado de fora. */}
        {geo.paredes.map((p, i) => {
          const meio = escalar(soma(p.a, p.b), 0.5)
          const pos = soma(meio, escalar(p.normal, 30 * px))
          let ang = (Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x) * 180) / Math.PI
          if (ang > 90) ang -= 180
          if (ang <= -90) ang += 180
          return (
            <text
              key={`m${i}`}
              x={pos.x}
              y={pos.y}
              transform={`rotate(${ang} ${pos.x} ${pos.y})`}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={14 * px}
              fontWeight={800}
              fill="var(--color-tinta)"
              className="pointer-events-none"
            >
              {Math.round(p.comprimento)} cm
            </text>
          )
        })}

        {/* Áreas de toque das paredes. */}
        {geo.paredes.map((p, i) => {
          const vertical = Math.abs(p.b.x - p.a.x) < Math.abs(p.b.y - p.a.y)
          return (
            <line
              key={`p${i}`}
              x1={p.inicio.x}
              y1={p.inicio.y}
              x2={p.fim.x}
              y2={p.fim.y}
              stroke="transparent"
              strokeWidth={26 * px}
              className={vertical ? 'cursor-ew-resize' : 'cursor-ns-resize'}
              onPointerDown={(e) => comecar(e, { tipo: 'parede', i })}
            />
          )
        })}

        {planta.portas.map((porta) => {
          const p = geo.paredes[porta.parede]
          if (!p) return null
          const centro = pontoNaParede(p, porta.t)
          const dir = escalar(sub(p.b, p.a), 1 / p.comprimento)
          const a = sub(centro, escalar(dir, porta.largura / 2))
          const b = soma(centro, escalar(dir, porta.largura / 2))
          const dentro = escalar(p.normal, -porta.largura)
          const folha = soma(a, dentro)
          const ativa = porta.id === portaAtiva
          const cor = ativa ? 'var(--color-terracota)' : 'var(--color-tinta)'
          return (
            <g key={porta.id} className="cursor-grab" onPointerDown={(e) => comecar(e, { tipo: 'porta', id: porta.id })}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-estudio)" strokeWidth={parede + 2 * px} />
              <path
                d={`M${b.x} ${b.y}A${porta.largura} ${porta.largura} 0 0 ${arcoHorario(dir, p.normal) ? 1 : 0} ${folha.x} ${folha.y}`}
                fill="none"
                stroke={cor}
                strokeWidth={1.5 * px}
                strokeDasharray={`${5 * px} ${4 * px}`}
              />
              <line x1={a.x} y1={a.y} x2={folha.x} y2={folha.y} stroke={cor} strokeWidth={3 * px} strokeLinecap="round" />
              <polygon
                points={[a, b, soma(b, dentro), folha].map((q) => `${q.x},${q.y}`).join(' ')}
                fill={ativa ? 'var(--color-terracota)' : 'transparent'}
                fillOpacity={0.12}
              />
            </g>
          )
        })}

        {planta.janelas.map((j) => {
          const p = geo.paredes[j.parede]
          if (!p) return null
          const centro = pontoNaParede(p, j.t)
          const dir = escalar(sub(p.b, p.a), 1 / p.comprimento)
          const a = sub(centro, escalar(dir, j.largura / 2))
          const b = soma(centro, escalar(dir, j.largura / 2))
          const ativa = j.id === portaAtiva
          const cor = ativa ? 'var(--color-terracota)' : 'var(--color-tinta)'
          const desvio = escalar(p.normal, parede / 3)
          return (
            <g key={j.id} className="cursor-grab" onPointerDown={(e) => comecar(e, { tipo: 'janela', id: j.id })}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-linho)" strokeWidth={parede + 2 * px} />
              {[-1, 0, 1].map((k) => (
                <line
                  key={k}
                  x1={a.x + desvio.x * k}
                  y1={a.y + desvio.y * k}
                  x2={b.x + desvio.x * k}
                  y2={b.y + desvio.y * k}
                  stroke={cor}
                  strokeWidth={(k ? 1.5 : 2.5) * px}
                />
              ))}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={24 * px} />
            </g>
          )
        })}

        {/* Alças no meio das paredes. */}
        {geo.paredes.map((p, i) => {
          const meio = escalar(soma(p.inicio, p.fim), 0.5)
          const ang = (Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x) * 180) / Math.PI
          if (comprimento(sub(p.fim, p.inicio)) < 60 * px) return null
          return (
            <rect
              key={`a${i}`}
              x={meio.x - 16 * px}
              y={meio.y - 7 * px}
              width={32 * px}
              height={14 * px}
              rx={7 * px}
              transform={`rotate(${ang} ${meio.x} ${meio.y})`}
              fill="var(--color-linho)"
              stroke="var(--color-tinta)"
              strokeWidth={2.5 * px}
              className="pointer-events-none"
            />
          )
        })}

        {planta.cantos.map((c, i) => (
          <g key={`c${i}`} className="cursor-move" onPointerDown={(e) => comecar(e, { tipo: 'canto', i })}>
            <circle cx={c.x} cy={c.y} r={20 * px} fill="transparent" />
            <circle
              cx={c.x}
              cy={c.y}
              r={9 * px}
              fill={c.raio ? 'var(--color-terracota)' : 'var(--color-linho)'}
              stroke="var(--color-tinta)"
              strokeWidth={2.5 * px}
            />
          </g>
        ))}
      </svg>

      <div className="absolute top-4 left-4 flex max-w-[calc(100%-5.5rem)] items-center overflow-x-auto [scrollbar-width:none] sm:max-w-[calc(100%-150px)] gap-1 rounded-full bg-linho/90 p-1 shadow-sm backdrop-blur">
        <span className="hidden pr-1 pl-3 text-xs font-bold text-pedra sm:inline">Toque na parede para pôr</span>
        {(
          [
            ['porta', 'Porta', <Porta key="porta" className="size-4" />],
            ['janela', 'Janela', <Janela key="janela" className="size-4" />],
          ] as const
        ).map(([id, rotulo, icone]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFerramenta(id)}
            aria-pressed={ferramenta === id}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${
              ferramenta === id ? 'bg-musgo text-linho' : 'hover:bg-creme'
            }`}
          >
            {icone} {rotulo}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!podeDesfazer('planta')}
        onClick={() => desfazer('planta')}
        className="botao absolute top-4 right-4 bg-linho/90 px-3 py-2.5 text-xs sm:px-4 sm:py-2 font-bold shadow-sm backdrop-blur enabled:cursor-pointer enabled:hover:bg-linho disabled:text-tinta/35"
      >
        <Desfazer /> <span className="max-sm:sr-only">Desfazer</span>
      </button>

      {ativa ? (
        <div className="absolute inset-x-4 bottom-4 mx-auto flex max-w-md items-center gap-2 rounded-full bg-linho p-1.5 pl-4 shadow-xl animar-surgir sm:pl-5">
          {porta ? <Porta className="size-4 shrink-0 text-terracota" /> : <Janela className="size-4 shrink-0 text-terracota" />}
          <span className="text-sm font-bold max-[359px]:sr-only">{porta ? 'Porta' : 'Janela'}</span>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-creme p-1">
            <BotaoRedondo rotulo="Diminuir largura" onClick={() => mudarLargura(ativa.largura - 10)}>
              <Menos />
            </BotaoRedondo>
            <span className="w-14 text-center text-sm font-bold tabular-nums">{ativa.largura} cm</span>
            <BotaoRedondo rotulo="Aumentar largura" onClick={() => mudarLargura(ativa.largura + 10)}>
              <Mais />
            </BotaoRedondo>
          </div>
          <button
            type="button"
            onClick={removerAtiva}
            className="botao cursor-pointer bg-tinta px-3.5 py-2.5 text-xs text-linho hover:bg-tinta/85 sm:px-4"
          >
            <Lixeira /> <span className="max-[399px]:sr-only">Remover</span>
          </button>
        </div>
      ) : (
        <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-2xl bg-linho/90 px-4 py-2 text-xs font-bold shadow-sm backdrop-blur sm:right-auto sm:rounded-full">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-tinta bg-linho" /> Canto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full border-2 border-tinta bg-linho" /> Parede
          </span>
          <span className="flex items-center gap-1.5">
            <Porta className="size-3.5" /> Porta
          </span>
          <span className="flex items-center gap-1.5">
            <Janela className="size-3.5" /> Janela
          </span>
        </div>
      )}
    </div>
  )
}

/** Sentido do arco da porta no SVG: de b até a folha aberta para dentro do cômodo. */
const arcoHorario = (dir: Ponto, normal: Ponto) => dir.x * -normal.y - dir.y * -normal.x > 0

function BotaoRedondo({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      className="grid size-8 cursor-pointer place-items-center rounded-full bg-linho transition hover:bg-white"
    >
      {children}
    </button>
  )
}
