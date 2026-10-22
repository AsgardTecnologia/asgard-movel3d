import { useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode } from 'react'
import {
  caixa,
  comprimento,
  desfazer,
  definirPlanta,
  geometria,
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
import { Desfazer, Lixeira, Mais, Menos, Mover, Porta } from './Icones'

type Arraste =
  | { tipo: 'canto'; i: number }
  | { tipo: 'parede'; i: number }
  | { tipo: 'porta'; id: string }

type Gesto = Arraste & { inicio: Ponto; tela: Ponto; cantos: Canto[]; moveu: boolean }

const GRADE = 10
const ajustar = (v: number) => Math.round(v / GRADE) * GRADE
const MARGEM = 140

export function EditorPlanta({ planta }: { planta: Planta }) {
  const svg = useRef<SVGSVGElement>(null)
  const gesto = useRef<Gesto | null>(null)
  const [portaAtiva, setPortaAtiva] = useState<string | null>(null)
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
      const porta = planta.portas.find((pt) => pt.id === g.id)
      const parede = geo.paredes[porta?.parede ?? -1]
      if (!porta || !parede) return
      const ab = sub(parede.b, parede.a)
      const t = ((p.x - parede.a.x) * ab.x + (p.y - parede.a.y) * ab.y) / parede.comprimento ** 2
      const portas = planta.portas.map((pt) =>
        pt.id === porta.id ? { ...pt, t: limitarPorta(parede, t, pt.largura) } : pt,
      )
      definirPlanta({ ...planta, portas }, false)
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
      if (comprimento(sub(parede.fim, parede.inicio)) < LARGURA_PORTA + 10) return
      const p = paraPlanta(e)
      const ab = sub(parede.b, parede.a)
      const t = ((p.x - parede.a.x) * ab.x + (p.y - parede.a.y) * ab.y) / parede.comprimento ** 2
      const porta = { id: novoIdPorta(), parede: g.i, t: limitarPorta(parede, t, LARGURA_PORTA), largura: LARGURA_PORTA }
      definirPlanta({ ...planta, portas: [...planta.portas, porta] })
      setPortaAtiva(porta.id)
    } else {
      setPortaAtiva(g.id)
    }
  }

  const porta = planta.portas.find((p) => p.id === portaAtiva)
  const mudarPorta = (largura: number) => {
    if (!porta) return
    const parede = geo.paredes[porta.parede]
    const nova = Math.max(60, Math.min(240, largura))
    if (comprimento(sub(parede.fim, parede.inicio)) < nova) return
    definirPlanta({
      ...planta,
      portas: planta.portas.map((p) => (p.id === porta.id ? { ...p, largura: nova, t: limitarPorta(parede, p.t, nova) } : p)),
    })
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

      <p className="pointer-events-none absolute top-4 left-4 inline-flex max-w-[calc(100%-150px)] items-center gap-2 rounded-full bg-linho/90 px-4 py-2 text-xs font-bold shadow-sm backdrop-blur">
        <Mover className="size-4 shrink-0 text-terracota" />
        <span className="truncate">Arraste paredes, bolinhas e portas · toque para editar</span>
      </p>

      <button
        type="button"
        disabled={!podeDesfazer('planta')}
        onClick={() => desfazer('planta')}
        className="botao absolute top-4 right-4 bg-linho/90 px-4 py-2 text-xs font-bold shadow-sm backdrop-blur enabled:cursor-pointer enabled:hover:bg-linho disabled:text-tinta/35"
      >
        <Desfazer /> Desfazer
      </button>

      {porta ? (
        <div className="absolute inset-x-4 bottom-4 mx-auto flex max-w-md items-center gap-2 rounded-full bg-linho p-1.5 pl-5 shadow-xl animar-surgir">
          <Porta className="size-4 shrink-0 text-terracota" />
          <span className="text-sm font-bold">Porta</span>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-creme p-1">
            <BotaoRedondo rotulo="Diminuir porta" onClick={() => mudarPorta(porta.largura - 10)}>
              <Menos />
            </BotaoRedondo>
            <span className="w-14 text-center text-sm font-bold tabular-nums">{porta.largura} cm</span>
            <BotaoRedondo rotulo="Aumentar porta" onClick={() => mudarPorta(porta.largura + 10)}>
              <Mais />
            </BotaoRedondo>
          </div>
          <button
            type="button"
            onClick={() => {
              definirPlanta({ ...planta, portas: planta.portas.filter((p) => p.id !== porta.id) })
              setPortaAtiva(null)
            }}
            className="botao cursor-pointer bg-tinta px-4 py-2.5 text-xs text-linho hover:bg-tinta/85"
          >
            <Lixeira /> Remover
          </button>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-4 rounded-full bg-linho/90 px-4 py-2 text-xs font-bold shadow-sm backdrop-blur">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-tinta bg-linho" /> Canto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full border-2 border-tinta bg-linho" /> Parede
          </span>
          <span className="flex items-center gap-1.5">
            <Porta className="size-3.5" /> Porta
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
