import { useEffect, useState } from 'react'
import { empresa, linkWhatsapp } from '../config'
import { abrirPainel, assinatura, temNomeProprio, useMarca } from '../lib/marca'
import { useAmbiente } from '../lib/ambiente'
import { hrefAmbiente, hrefSecao } from '../router'
import { Fechar, Menu, Paleta, Planta, Seta } from './Icones'

const links = [
  { rotulo: 'Demonstração', secao: 'catalogo' },
  { rotulo: 'Para quem', secao: 'ambientes' },
  { rotulo: 'Benefícios', secao: 'sobre' },
  { rotulo: 'Como funciona', secao: 'realidade-aumentada' },
]

export function Header() {
  const [aberto, setAberto] = useState(false)
  const [rolou, setRolou] = useState(false)
  const marca = useMarca()
  const proprio = temNomeProprio(marca)
  const qtdAmbiente = useAmbiente().itens.length

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 40)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  return (
    <>
      <div className="bg-musgo-escuro text-linho/80">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium sm:justify-between md:px-8">
          <span className="truncate">{proprio ? `Prévia personalizada para a loja ${marca.nome}` : empresa.slogan}</span>
          <span className="hidden shrink-0 sm:inline">
            {proprio ? `Catálogo 3D por ${empresa.nome}` : 'Demonstração gratuita para a sua loja'}
          </span>
        </div>
      </div>

      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          rolou ? 'border-b border-tinta/8 bg-linho/85 backdrop-blur-xl' : 'bg-linho'
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 md:px-8">
          <a href="#/" className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate font-display text-[28px] leading-none">{marca.nome}</span>
            <span className="size-1.5 rounded-full bg-terracota" />
          </a>

          <nav className="hidden items-center gap-1 rounded-full border border-tinta/10 bg-white/60 p-1 lg:flex">
            {links.map((l) => (
              <a
                key={l.secao}
                href={hrefSecao(l.secao)}
                className="rounded-full px-5 py-2 text-sm font-medium text-tinta/70 transition hover:bg-creme hover:text-tinta"
              >
                {l.rotulo}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <a
              href={hrefAmbiente}
              className="botao relative border border-tinta/15 px-4 py-3 hover:border-tinta xl:px-5"
            >
              <Planta className="size-4 text-terracota" />
              <span className="hidden xl:inline">Ambiente</span>
              {qtdAmbiente > 0 && <Contador n={qtdAmbiente} />}
            </a>
            <button
              type="button"
              onClick={() => abrirPainel()}
              aria-label="Personalizar com a minha loja"
              className="botao cursor-pointer border border-tinta/15 px-4 py-3 hover:border-tinta xl:px-5"
            >
              <Paleta className="size-4 text-terracota" />
              <span className="hidden xl:inline">Personalizar</span>
            </button>
            <a
              href={linkWhatsapp(`Olá! Vim pelo site da ${empresa.nome} e quero agendar uma demonstração do catálogo 3D.${assinatura(marca)}`)}
              target="_blank"
              rel="noreferrer"
              className="botao group bg-musgo py-3 text-linho hover:bg-musgo-escuro"
            >
              Agendar demonstração
              <Seta className="size-4 transition group-hover:translate-x-0.5" />
            </a>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
          <a
            href={hrefAmbiente}
            aria-label="Meu ambiente"
            className="relative grid size-11 shrink-0 place-items-center rounded-full border border-tinta/15"
          >
            <Planta className="size-5" />
            {qtdAmbiente > 0 && <Contador n={qtdAmbiente} />}
          </a>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-tinta/15"
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          >
            {aberto ? <Fechar className="size-5" /> : <Menu className="size-5" />}
          </button>
          </div>
        </div>

        {aberto && (
          <nav className="border-t border-tinta/10 bg-linho px-5 pb-6 lg:hidden">
            {links.map((l) => (
              <a
                key={l.secao}
                href={hrefSecao(l.secao)}
                onClick={() => setAberto(false)}
                className="flex items-center justify-between border-b border-tinta/10 py-4 font-display text-3xl"
              >
                {l.rotulo}
                <Seta className="size-5 text-pedra" />
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                abrirPainel()
              }}
              className="botao mt-6 w-full cursor-pointer bg-musgo text-linho"
            >
              <Paleta className="size-4" /> Personalizar com a minha loja
            </button>
          </nav>
        )}
      </header>
    </>
  )
}

const Contador = ({ n }: { n: number }) => (
  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-terracota text-[10px] font-bold text-linho">
    {n}
  </span>
)
