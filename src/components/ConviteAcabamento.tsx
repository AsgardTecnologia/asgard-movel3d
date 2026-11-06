import { useEffect, useState } from 'react'
import { definirAcabamento, lerAmbiente, papeis, pisos, useAmbiente, type Acabamento } from '../lib/ambiente'
import type { ConviteRA } from '../lib/conviteRA'
import { miniaturaPapel } from '../lib/texturasParede'
import { miniaturaPiso } from '../lib/texturasPiso'
import { ProvadorRA } from './ProvadorRA'

type Convite = Extract<ConviteRA, { tipo: 'piso' | 'parede' }>
type Props = { convite: Convite; aoFechar: () => void }

/** Põe no ambiente o piso e a parede que vieram no QR code (só os que existem no catálogo). */
function aplicar(convite: Convite) {
  const mudanca: Partial<Acabamento> = {}
  const tipoPiso = pisos.find((p) => p.id === convite.piso)
  if (tipoPiso) {
    mudanca.piso = tipoPiso.id
    mudanca.corPiso = convite.corPiso ?? tipoPiso.cores[0].hex
  }
  const papel = papeis.find((p) => p.id === convite.papel)
  if (papel) mudanca.papel = papel.id
  if (convite.paredes) mudanca.paredes = convite.paredes
  definirAcabamento(mudanca, false)
}

/**
 * Chegou pelo QR code do provador de piso e parede: aplica o acabamento escolhido no computador e
 * mostra o botão que abre a câmera (o navegador só abre com um toque). Carregado só nesse caso: usa o
 * three.js, para as miniaturas e o provador.
 */
export default function ConviteAcabamento({ convite, aoFechar }: Props) {
  // A escolha vale já na primeira pintura (aplicar de novo é inofensivo).
  const [celular] = useState(() => {
    aplicar(convite)
    return matchMedia('(pointer: coarse)').matches
  })
  const { acabamento } = useAmbiente()
  /** Depois do toque, a folha sai da frente; o provador continua montado (a câmera é dele). */
  const [usado, setUsado] = useState(false)

  // No computador não há câmera para abrir: a escolha vale, sem a folha.
  useEffect(() => {
    if (!celular) aoFechar()
  }, [celular, aoFechar])

  if (!celular) return null
  const piso = convite.tipo === 'piso'
  const imagem = piso ? miniaturaPiso(acabamento.piso, acabamento.corPiso) : miniaturaPapel(acabamento.papel, acabamento.paredes)
  const nome = piso
    ? pisos.find((p) => p.id === acabamento.piso)?.rotulo
    : papeis.find((p) => p.id === acabamento.papel)?.rotulo

  return (
    <div
      className={usado ? 'hidden' : 'fixed inset-0 z-[70] grid items-end bg-tinta/50 backdrop-blur-sm sm:place-items-center sm:p-5'}
      role="dialog"
      aria-modal="true"
      aria-label="Provar no meu espaço"
    >
      <div className="w-full space-y-4 rounded-t-[28px] bg-linho p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animar-surgir sm:max-w-md sm:rounded-[28px]">
        <div className="flex items-center gap-4">
          <img src={imagem} alt="" className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-tinta/10" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-terracota uppercase">{piso ? 'Piso' : 'Parede'}</p>
            <h2 className="text-[26px] leading-tight">{nome}</h2>
            <p className="text-sm font-semibold text-pedra">Do jeito que você escolheu</p>
          </div>
        </div>
        <div onClickCapture={() => setTimeout(() => setUsado(true), 0)}>
          <ProvadorRA
            acabamento={acabamento}
            peDireito={lerAmbiente().planta.peDireito}
            modoInicial={convite.tipo}
            rotulo={piso ? 'Abrir a câmera e ver no chão' : 'Abrir a câmera e ver na parede'}
          />
        </div>
        <button type="button" onClick={aoFechar} className="botao w-full cursor-pointer bg-creme py-3.5">
          Agora não
        </button>
      </div>
    </div>
  )
}
