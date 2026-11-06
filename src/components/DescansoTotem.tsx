import { useEffect, useState } from 'react'
import { ambientesProntos } from '../data/ambientesProntos'
import { reiniciarAmbiente } from '../lib/ambiente'
import { useMarca } from '../lib/marca'
import { OCIOSO_MS } from '../lib/totem'
import { hrefAmbiente } from '../router'
import { Camera, Cubo, Paleta } from './Icones'

const fotos = ambientesProntos.filter((a) => a.foto)

/**
 * Tela de descanso do totem: fotos dos ambientes passando e "Toque para começar".
 * Aparece ao ligar e depois de um tempo sem toque, e zera o ambiente para o próximo cliente.
 */
export function DescansoTotem() {
  const [ativo, setAtivo] = useState(true)
  const [atual, setAtual] = useState(0)
  const marca = useMarca()

  // Sem toque por OCIOSO_MS: volta ao descanso.
  useEffect(() => {
    if (ativo) return
    let timer = window.setTimeout(() => setAtivo(true), OCIOSO_MS)
    const mexeu = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => setAtivo(true), OCIOSO_MS)
    }
    const eventos = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const
    eventos.forEach((e) => window.addEventListener(e, mexeu, { passive: true }))
    return () => {
      clearTimeout(timer)
      eventos.forEach((e) => window.removeEventListener(e, mexeu))
    }
  }, [ativo])

  useEffect(() => {
    if (!ativo || fotos.length < 2) return
    const t = window.setInterval(() => setAtual((i) => (i + 1) % fotos.length), 5000)
    return () => clearInterval(t)
  }, [ativo])

  if (!ativo) return null

  const comecar = () => {
    reiniciarAmbiente()
    location.hash = hrefAmbiente
    window.scrollTo({ top: 0 })
    setAtivo(false)
  }

  return (
    <button
      type="button"
      onClick={comecar}
      aria-label="Toque para começar"
      className="fixed inset-0 z-[200] flex cursor-pointer flex-col overflow-hidden bg-musgo-escuro text-left text-linho totem-h:flex-row"
    >
      <span className="relative block h-[58%] shrink-0 overflow-hidden totem-h:h-full totem-h:w-[56%]">
        {fotos.map((a, i) => (
          <img
            key={a.id}
            src={a.foto}
            alt=""
            className="absolute inset-0 size-full object-cover transition-opacity duration-[1600ms]"
            style={{ opacity: i === atual ? 1 : 0, animation: i === atual ? 'aproximar 6s ease-out both' : undefined }}
          />
        ))}
        <span className="absolute inset-0 bg-gradient-to-b from-musgo-escuro/60 via-transparent to-musgo-escuro totem-h:bg-gradient-to-r totem-h:from-transparent totem-h:via-transparent totem-h:to-musgo-escuro" />
        <span className="absolute inset-x-0 top-0 hidden h-48 bg-gradient-to-b from-musgo-escuro/60 to-transparent totem-h:block" />
        <span className="absolute top-0 left-0 flex items-baseline gap-2 p-14">
          <span className="font-display text-[56px] leading-none">{marca.nome}</span>
          <span className="size-3 rounded-full bg-terracota" />
        </span>
        <span className="absolute bottom-8 left-14 rounded-full bg-linho/15 px-5 py-2.5 text-[18px] font-bold tracking-wide backdrop-blur">
          {fotos[atual]?.nome}
        </span>
      </span>

      <span className="flex flex-1 flex-col justify-center px-14 pb-14 totem-h:py-14 totem-h:pr-16 totem-h:pl-10">
        {/* Em vw para caber nos totens com escala de 150% (1080×1920 vira 720×1280). */}
        <span className="block font-display text-[min(96px,11vw)] leading-[0.92] totem-h:text-[min(84px,4.6vw)]">
          Monte o seu
          <br />
          ambiente em 3D
        </span>
        <span className="mt-6 block max-w-3xl text-[26px] leading-snug text-linho/80">
          Escolha um ambiente pronto, troque as cores das paredes, o piso e os móveis, e veja tudo em tamanho real.
        </span>

        <span className="mt-8 flex flex-wrap gap-3 text-[19px] font-semibold text-linho/90">
          {[
            [<Cubo key="c" className="size-6" />, 'Ambientes prontos'],
            [<Paleta key="p" className="size-6" />, 'Pinte paredes e piso'],
            [<Camera key="r" className="size-6" />, 'Veja no seu espaço'],
          ].map(([icone, texto]) => (
            <span key={texto as string} className="inline-flex items-center gap-3 rounded-full bg-linho/10 px-5 py-3.5">
              {icone}
              {texto}
            </span>
          ))}
        </span>

        <span className="mt-10 flex flex-wrap items-center justify-between gap-6">
          <span className="inline-flex items-center rounded-full bg-terracota px-14 py-7 text-[32px] font-bold [animation:pulsar_2.4s_ease-in-out_infinite]">
            Toque para começar
          </span>
          <span className="flex gap-2">
            {fotos.map((a, i) => (
              <span key={a.id} className={`h-1.5 rounded-full transition-all duration-500 ${i === atual ? 'w-12 bg-linho' : 'w-4 bg-linho/35'}`} />
            ))}
          </span>
        </span>
      </span>
    </button>
  )
}
