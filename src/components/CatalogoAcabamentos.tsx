import { useState } from 'react'
import {
  coresParede,
  definirAcabamento,
  irPara,
  lerAmbiente,
  papeis,
  pisos,
  useAmbiente,
  type OpcaoCor,
  type TipoPapel,
  type TipoPiso,
} from '../lib/ambiente'
import { desenharPapel } from '../lib/texturasParede'
import { desenharPiso } from '../lib/texturasPiso'
import { hrefAmbiente } from '../router'
import { Camera, Cubo, Seta } from './Icones'
import { ProvadorRA } from './ProvadorRA'

/**
 * Pisos e revestimentos de parede no catálogo, para provar em realidade aumentada como os móveis.
 * Carregado só quando a pessoa abre a aba (as texturas usam o three.js).
 */
export type Superficie = 'piso' | 'parede'

const amostras = new Map<string, string>()
/** Amostra grande e nítida para o card (as miniaturas do editor são pequenas). */
const amostra = (superficie: Superficie, tipo: string, cor: string) => {
  const chave = `${superficie}${tipo}${cor}`
  if (!amostras.has(chave)) {
    const canvas = superficie === 'piso' ? desenharPiso(tipo as TipoPiso, cor, 512) : desenharPapel(tipo as TipoPapel, cor, 512)
    amostras.set(chave, canvas.toDataURL('image/jpeg', 0.85))
  }
  return amostras.get(chave)!
}

/** Cor com que cada revestimento aparece primeiro (o tijolinho em tijolo, o ripado em madeira…). */
const corInicialParede: Record<TipoPapel, string> = {
  lisa: '#b9c4ae',
  linho: '#e6dccb',
  listras: '#aebcc8',
  losangos: '#dfbfb1',
  tijolinho: '#b0613f',
  ripado: '#9a6b45',
  marmore: '#ece9e4',
  azulejo: '#f4f2ee',
  pedra: '#a59d90',
  cimento: '#a9a49b',
}

type Opcao = { id: string; rotulo: string; cores: OpcaoCor[] }

const opcoes = (superficie: Superficie): Opcao[] =>
  superficie === 'piso'
    ? pisos.map((p) => ({ id: p.id, rotulo: p.rotulo, cores: p.cores }))
    : papeis.map((p) => {
        const inicial = corInicialParede[p.id]
        const cores = coresParede.some((c) => c.hex === inicial)
          ? [coresParede.find((c) => c.hex === inicial)!, ...coresParede.filter((c) => c.hex !== inicial)]
          : [{ nome: p.rotulo, hex: inicial }, ...coresParede]
        return { id: p.id, rotulo: p.rotulo, cores }
      })

export default function CatalogoAcabamentos({ superficie }: { superficie: Superficie }) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-12 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-3 totem-v:grid-cols-2 totem-h:grid-cols-3">
      {opcoes(superficie).map((o) => (
        <div key={o.id} className="animar-surgir">
          <CardAcabamento superficie={superficie} opcao={o} />
        </div>
      ))}
    </div>
  )
}

function CardAcabamento({ superficie, opcao }: { superficie: Superficie; opcao: Opcao }) {
  const { acabamento } = useAmbiente()
  const [cor, setCor] = useState(0)
  const escolhida = opcao.cores[cor] ?? opcao.cores[0]
  const imagem = amostra(superficie, opcao.id, escolhida.hex)

  /** Leva a escolha para o ambiente: o provador e o 3D usam o acabamento de lá. */
  const aplicar = () =>
    definirAcabamento(
      superficie === 'piso'
        ? { piso: opcao.id as TipoPiso, corPiso: escolhida.hex }
        : { papel: opcao.id as TipoPapel, paredes: escolhida.hex, porParede: null },
    )

  const verNoAmbiente = () => {
    aplicar()
    if (lerAmbiente().etapa === 'galeria') irPara('3d')
    location.hash = hrefAmbiente
  }

  return (
    <article className="group">
      <div className="relative aspect-[5/4] overflow-hidden rounded-[20px] bg-estudio sm:aspect-[4/5]">
        {superficie === 'piso' ? <CantoComPiso imagem={imagem} /> : <CantoComParede imagem={imagem} />}
        <span className="absolute top-4 left-4 flex gap-1.5">
          <span className="rounded-full bg-linho/90 px-3 py-1.5 text-[11px] font-bold tracking-wide text-tinta/80 backdrop-blur">
            {superficie === 'piso' ? 'Piso' : 'Parede'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-musgo px-3 py-1.5 text-[11px] font-bold text-linho">
            <Camera className="size-3.5" /> RA
          </span>
        </span>
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[28px] leading-tight">{opcao.rotulo}</h3>
          <p className="mt-1 text-sm font-semibold text-pedra">{escolhida.nome}</p>
        </div>
        <button
          type="button"
          onClick={verNoAmbiente}
          className="botao shrink-0 cursor-pointer border border-tinta/15 px-4 py-2.5 text-xs hover:border-tinta hover:bg-linho"
        >
          <Cubo className="size-4 text-terracota" /> No ambiente <Seta />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Cores disponíveis">
        {opcao.cores.map((c, i) => (
          <button
            key={c.nome + c.hex}
            type="button"
            role="radio"
            aria-checked={i === cor}
            aria-label={c.nome}
            title={c.nome}
            onClick={() => setCor(i)}
            className={`size-7 cursor-pointer rounded-full border-2 border-linho transition ${
              i === cor ? 'scale-110 ring-[1.5px] ring-tinta' : 'ring-1 ring-tinta/15 hover:ring-tinta/50'
            }`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>

      {/* A escolha vai para o ambiente no toque, antes de o provador abrir com ela. */}
      <div onPointerDownCapture={aplicar} onKeyDownCapture={(e) => (e.key === 'Enter' || e.key === ' ') && aplicar()}>
        <ProvadorRA
          acabamento={acabamento}
          peDireito={lerAmbiente().planta.peDireito}
          modoInicial={superficie}
          rotulo={superficie === 'piso' ? 'Provar este piso no meu espaço' : 'Provar nesta parede'}
        />
      </div>
    </article>
  )
}

/** Canto de cômodo com o piso em perspectiva e uma parede clara ao fundo. */
function CantoComPiso({ imagem }: { imagem: string }) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-[#f1ece3] to-[#e7e0d4]" />
      <div className="absolute inset-x-0 top-[26%] h-[2.5%] bg-[#fbfaf7] shadow-[0_2px_6px_rgba(0,0,0,0.08)]" />
      <div className="absolute inset-x-0 top-[28.5%] bottom-0 overflow-hidden [perspective:420px]">
        {/* Desenho repetido (não esticado): nítido e com várias peças à vista, como num piso de verdade. */}
        <div
          className="absolute top-0 -left-full h-[240%] w-[300%] origin-top transition duration-700 group-hover:scale-[1.03]"
          style={{ backgroundImage: `url(${imagem})`, backgroundSize: '14%', transform: 'rotateX(58deg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
      </div>
    </>
  )
}

/** Parede revestida até o rodapé, com uma faixa de piso de madeira. */
function CantoComParede({ imagem }: { imagem: string }) {
  return (
    <>
      <div
        className="absolute inset-x-0 top-0 h-[84%] transition duration-700 group-hover:scale-[1.04]"
        style={{ backgroundImage: `url(${imagem})`, backgroundSize: '55%' }}
      />
      <div className="absolute inset-x-0 top-0 h-[84%] bg-gradient-to-b from-black/10 via-transparent to-black/10" />
      <div className="absolute inset-x-0 top-[84%] h-[2.5%] bg-[#fbfaf7] shadow-[0_2px_6px_rgba(0,0,0,0.12)]" />
      <div className="absolute inset-x-0 top-[86.5%] bottom-0 bg-gradient-to-b from-[#a87a50] to-[#8e643f]" />
    </>
  )
}
