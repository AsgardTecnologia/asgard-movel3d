import { useState } from 'react'
import type { Movel } from '../data/moveis'
import { hrefMovel } from '../router'
import { AdicionarAmbienteCard } from './AdicionarAmbiente'
import { FotoMovel } from './FotoMovel'
import { Cubo, Seta } from './Icones'
import { SeletorCores } from './SeletorCores'

export function CardMovel({
  movel,
  largo = false,
  aspecto = 'aspect-[5/4] sm:aspect-[4/5]',
}: {
  movel: Movel
  largo?: boolean
  aspecto?: string
}) {
  const [cor, setCor] = useState(0)

  return (
    <article className="group relative">
      <a href={hrefMovel(movel.slug)} className="relative block">
        <FotoMovel
          imagem={movel.imagem}
          cor={movel.cores[cor]}
          original={cor === 0}
          alt={`${movel.nome} na cor ${movel.cores[cor].nome}`}
          largura={largo ? 1400 : 800}
          enquadramento={movel.enquadramento}
          className={`rounded-[20px] ${largo ? 'aspect-[4/3] sm:aspect-[8/5]' : aspecto}`}
        />
        <span className="absolute top-4 left-4 flex gap-1.5">
          <span className="rounded-full bg-linho/90 px-3 py-1.5 text-[11px] font-bold tracking-wide text-tinta/80 backdrop-blur">
            {movel.categoria}
          </span>
          {movel.modelo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-musgo px-3 py-1.5 text-[11px] font-bold text-linho">
              <Cubo className="size-3.5" /> 3D · RA
            </span>
          )}
        </span>
        <span className="absolute right-4 bottom-4 inline-flex translate-y-2 items-center gap-2 rounded-full bg-linho px-4 py-2.5 text-xs font-bold opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          Ver detalhes <Seta className="size-3.5" />
        </span>
      </a>
      <AdicionarAmbienteCard movel={movel} cor={cor} className="absolute top-4 right-4" />

      <div className="mt-4 flex items-start justify-between gap-4 px-1">
        <a href={hrefMovel(movel.slug)} className="min-w-0">
          <h3 className="text-[24px] leading-tight sm:text-[26px]">{movel.nome}</h3>
          <p className="mt-1 truncate text-sm text-pedra">{movel.resumo}</p>
        </a>
        <div className="flex shrink-0 flex-col items-end gap-2 pt-1.5">
          <SeletorCores cores={movel.cores} selecionada={cor} onSelecionar={setCor} />
          <span className="text-xs font-semibold text-pedra">{movel.cores[cor].nome}</span>
        </div>
      </div>
    </article>
  )
}
