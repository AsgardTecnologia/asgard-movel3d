import { useEffect, useState } from 'react'
import {
  abrirPainel,
  coresLegiveis,
  definirMarca,
  linkPersonalizado,
  marcaPadrao,
  personalizada,
  restaurarMarca,
  useMarca,
  usePainel,
  type Marca,
} from '../lib/marca'
import { Fechar, Seta } from './Icones'

type Chave = 'principal' | 'fundo' | 'destaque' | 'estudio'

const campos: { chave: Chave; rotulo: string; uso: string }[] = [
  { chave: 'principal', rotulo: 'Cor principal', uso: 'Botões, faixas e fundos escuros' },
  { chave: 'fundo', rotulo: 'Cor de fundo', uso: 'Seções claras do site' },
  { chave: 'destaque', rotulo: 'Cor de destaque', uso: 'Títulos em itálico e selos' },
  { chave: 'estudio', rotulo: 'Fundo das peças', uso: 'Atrás dos móveis e no topo do site' },
]

const paletas: { nome: string; cores: [string, string, string, string] }[] = [
  { nome: 'Original', cores: [marcaPadrao.principal, marcaPadrao.fundo, marcaPadrao.destaque, marcaPadrao.estudio] },
  { nome: 'Marinho', cores: ['#1f3a5f', '#f2f0eb', '#c8963e', '#e4e8ee'] },
  { nome: 'Grafite', cores: ['#262626', '#f4f2ef', '#d4572a', '#e7e5e2'] },
  { nome: 'Vinho', cores: ['#5a2a3a', '#f7efec', '#c97b84', '#efe2df'] },
  { nome: 'Petróleo', cores: ['#12464f', '#eef2f0', '#e0a458', '#dfe8e6'] },
]

/** Nome da loja + 4 cores. Tudo muda no site na hora, enquanto a pessoa digita. */
export function FormMarca({ aoVer }: { aoVer?: () => void }) {
  const marca = useMarca()
  const [nome, setNome] = useState(marca.nome === marcaPadrao.nome ? '' : marca.nome)
  const [copiado, setCopiado] = useState(false)
  const legiveis = coresLegiveis(marca)
  const ajustadas = campos.filter((c) => legiveis[c.chave] !== marca[c.chave])

  // Se o nome mudar por fora (outro formulário, "Voltar ao original"), o campo acompanha.
  const [nomeVisto, setNomeVisto] = useState(marca.nome)
  if (nomeVisto !== marca.nome) {
    setNomeVisto(marca.nome)
    if ((nome.trim() || marcaPadrao.nome) !== marca.nome) setNome(marca.nome === marcaPadrao.nome ? '' : marca.nome)
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linkPersonalizado(marca))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copie o link:', linkPersonalizado(marca))
    }
  }

  return (
    <div className="text-tinta">
      <label className="block">
        <span className="text-sm font-bold">Nome da sua loja</span>
        <input
          value={nome}
          maxLength={32}
          placeholder="Ex.: Casa Lume Móveis"
          onChange={(e) => {
            setNome(e.target.value)
            definirMarca({ nome: e.target.value.trim() || marcaPadrao.nome })
          }}
          className="mt-2 w-full rounded-full border border-tinta/15 bg-linho px-5 py-3.5 font-semibold outline-none transition placeholder:font-medium placeholder:text-tinta/35 focus:border-musgo focus:ring-2 focus:ring-musgo/20"
        />
      </label>

      <p className="mt-6 text-sm font-bold">As 4 cores da sua marca</p>
      <div className="mt-2 space-y-2">
        {campos.map((c) => (
          <CampoCor key={c.chave} rotulo={c.rotulo} uso={c.uso} valor={marca[c.chave]} aoMudar={(v) => definirMarca({ [c.chave]: v })} />
        ))}
      </div>

      {ajustadas.length > 0 && (
        <p className="mt-3 rounded-2xl bg-creme px-4 py-3 text-xs font-semibold text-pedra">
          Ajustamos um pouco o tom da {ajustadas.map((c) => c.rotulo.toLowerCase()).join(' e da ')} para os textos
          continuarem legíveis.
        </p>
      )}

      <p className="mt-6 text-sm font-bold">Ou comece por uma paleta</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {paletas.map((p) => {
          const ativa = p.cores.join() === [marca.principal, marca.fundo, marca.destaque, marca.estudio].join()
          return (
            <button
              key={p.nome}
              type="button"
              onClick={() =>
                definirMarca({ principal: p.cores[0], fundo: p.cores[1], destaque: p.cores[2], estudio: p.cores[3] })
              }
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${
                ativa ? 'border-tinta bg-linho' : 'border-tinta/10 hover:border-tinta/40'
              }`}
            >
              <span className="flex -space-x-1">
                {p.cores.map((cor) => (
                  <span key={cor} className="size-4 rounded-full border-2 border-linho" style={{ backgroundColor: cor }} />
                ))}
              </span>
              {p.nome}
            </button>
          )
        })}
      </div>

      <div className="mt-7 grid gap-2 sm:grid-cols-2">
        {aoVer && (
          <button
            type="button"
            onClick={aoVer}
            className="botao group cursor-pointer bg-musgo text-linho hover:bg-musgo-escuro sm:col-span-2"
          >
            Ver o site com a minha marca <Seta className="size-4 transition group-hover:translate-x-0.5" />
          </button>
        )}
        <button type="button" onClick={copiar} className="botao cursor-pointer border border-tinta/15 hover:border-tinta">
          {copiado ? 'Link copiado!' : 'Copiar link da prévia'}
        </button>
        <button
          type="button"
          onClick={restaurarMarca}
          disabled={!personalizada(marca)}
          className="botao border border-tinta/15 text-pedra enabled:cursor-pointer enabled:hover:border-tinta enabled:hover:text-tinta disabled:opacity-40"
        >
          Voltar ao original
        </button>
      </div>
    </div>
  )
}

function CampoCor({ rotulo, uso, valor, aoMudar }: { rotulo: string; uso: string; valor: string; aoMudar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor)
  const [valorVisto, setValorVisto] = useState(valor)
  if (valorVisto !== valor) {
    setValorVisto(valor)
    if (texto.toLowerCase() !== valor) setTexto(valor)
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-tinta/10 bg-linho p-2.5 pr-3">
      <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-tinta/15" style={{ backgroundColor: valor }}>
        <input
          type="color"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          aria-label={rotulo}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{rotulo}</p>
        <p className="truncate text-xs text-pedra">{uso}</p>
      </div>
      <input
        value={texto}
        maxLength={7}
        aria-label={`${rotulo} em hexadecimal`}
        onChange={(e) => {
          const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
          setTexto(v)
          if (/^#[0-9a-f]{6}$/i.test(v)) aoMudar(v.toLowerCase())
        }}
        className="w-[88px] rounded-full bg-creme px-3 py-2 text-center font-mono text-xs font-semibold uppercase outline-none focus:ring-2 focus:ring-musgo/30"
      />
    </div>
  )
}

/** Gaveta lateral (embaixo, no celular) com o formulário. Fica clara por trás para o site mudar à vista. */
export function PainelPersonalizar() {
  const aberto = usePainel()

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && abrirPainel(false)
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Personalizar o site">
      <div className="absolute inset-0 bg-tinta/20" onClick={() => abrirPainel(false)} />
      <div className="animar-surgir absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto rounded-t-[28px] bg-creme p-6 shadow-2xl sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:w-[440px] sm:rounded-[28px] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-terracota">Personalize</p>
            <h2 className="mt-3 text-[34px] leading-[1.05]">Veja o site com a sua marca.</h2>
          </div>
          <button
            type="button"
            onClick={() => abrirPainel(false)}
            aria-label="Fechar"
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-linho"
          >
            <Fechar className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-pedra">
          O nome e as cores mudam na hora, no header, no catálogo, nos mockups e nas mensagens de WhatsApp.
        </p>
        <div className="mt-6">
          <FormMarca
            aoVer={() => {
              abrirPainel(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </div>
      </div>
    </div>
  )
}

/** Atalho fixo no canto da tela, com as cores atuais. */
export function BotaoPersonalizar() {
  const marca = useMarca()
  const aberto = usePainel()
  if (aberto) return null

  return (
    <button
      type="button"
      onClick={() => abrirPainel()}
      className="fixed bottom-5 left-5 z-40 inline-flex cursor-pointer items-center gap-3 rounded-full bg-tinta py-2.5 pr-5 pl-2.5 text-sm font-bold text-linho shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition hover:-translate-y-0.5"
    >
      <Cores marca={marca} />
      {personalizada(marca) ? 'Editar marca' : 'Personalizar'}
    </button>
  )
}

export function Cores({ marca }: { marca: Marca }) {
  return (
    <span className="flex -space-x-1.5">
      {[marca.principal, marca.fundo, marca.destaque, marca.estudio].map((cor, i) => (
        <span key={i} className="size-6 rounded-full border-2 border-tinta" style={{ backgroundColor: cor }} />
      ))}
    </span>
  )
}
