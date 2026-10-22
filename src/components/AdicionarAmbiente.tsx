import { useEffect, useState } from 'react'
import type { Movel } from '../data/moveis'
import { adicionarItem, useAmbiente } from '../lib/ambiente'
import { hrefAmbiente } from '../router'
import { Check, Mais, Planta, Seta } from './Icones'

type Props = { movel: Movel; cor: number }

const useAdicionar = ({ movel, cor }: Props) => {
  const { itens } = useAmbiente()
  const [recente, setRecente] = useState(false)
  const quantos = itens.filter((i) => i.slug === movel.slug).length

  useEffect(() => {
    if (!recente) return
    const t = setTimeout(() => setRecente(false), 2400)
    return () => clearTimeout(t)
  }, [recente])

  const adicionar = () => {
    adicionarItem(movel.slug, cor)
    setRecente(true)
  }
  return { quantos, recente, adicionar }
}

/** Botão da página do produto: adiciona na cor escolhida e leva ao ambiente. */
export function AdicionarAmbiente(props: Props) {
  const { quantos, recente, adicionar } = useAdicionar(props)
  if (!props.movel.modelo) return null

  return (
    <div className="mt-3 overflow-hidden rounded-[20px] border border-tinta/15">
      <button
        type="button"
        onClick={adicionar}
        className="botao w-full cursor-pointer rounded-none py-4 hover:bg-creme"
      >
        {recente ? <Check className="size-4 text-terracota" /> : <Planta className="size-4 text-terracota" />}
        {recente ? 'Adicionado ao seu ambiente' : 'Adicionar ao ambiente'}
      </button>
      {quantos > 0 && (
        <a
          href={hrefAmbiente}
          className="group flex items-center justify-between gap-3 border-t border-tinta/10 bg-creme px-5 py-3 text-sm font-semibold transition hover:bg-areia"
        >
          <span>
            {quantos === 1 ? 'Esta peça já está' : `${quantos} desta peça estão`} no seu ambiente. Monte o cômodo e veja como fica.
          </span>
          <Seta className="size-4 shrink-0 transition group-hover:translate-x-0.5" />
        </a>
      )}
    </div>
  )
}

/** Versão compacta, sobre a foto dos cards do catálogo. */
export function AdicionarAmbienteCard(props: Props & { className?: string }) {
  const { recente, adicionar } = useAdicionar(props)
  if (!props.movel.modelo) return null

  return (
    <button
      type="button"
      onClick={adicionar}
      aria-label={`Adicionar ${props.movel.nome} ao ambiente`}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg transition ${
        recente ? 'bg-terracota text-linho' : 'bg-linho/95 text-tinta backdrop-blur hover:bg-linho'
      } ${props.className ?? ''}`}
    >
      {recente ? <Check className="size-3.5" /> : <Mais className="size-3.5" />}
      {recente ? 'No ambiente' : 'Ambiente'}
    </button>
  )
}
