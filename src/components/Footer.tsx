import { empresa, linkWhatsapp } from '../config'
import { categorias } from '../data/moveis'
import { assinatura, temNomeProprio, useMarca } from '../lib/marca'
import { hrefSecao } from '../router'
import { Instagram, Whatsapp } from './Icones'

export function Footer() {
  const marca = useMarca()
  const proprio = temNomeProprio(marca)

  return (
    <footer id="contato" className="scroll-mt-20 overflow-hidden bg-musgo-escuro text-linho/75">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-x-6 gap-y-10 px-5 pt-14 pb-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:gap-12 md:px-8 md:pt-20 md:pb-12">
        <div className="col-span-2 md:col-span-1">
          <p className="flex items-baseline gap-1.5 font-display text-[28px] leading-none text-linho">
            {marca.nome}
            <span className="size-1.5 rounded-full bg-terracota" />
          </p>
          <p className="mt-5 max-w-xs font-display text-[26px] leading-tight text-linho/85 sm:text-3xl">
            {proprio ? 'Seu catálogo em 3D, na casa de cada cliente.' : 'Seu catálogo em 3D, na casa do seu cliente.'}
          </p>
          <div className="mt-8 flex gap-3">
            <a
              href={empresa.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="grid size-11 place-items-center rounded-full border border-linho/20 transition hover:bg-linho hover:text-musgo"
            >
              <Instagram />
            </a>
            <a
              href={linkWhatsapp(`Olá! Vim pelo site da ${empresa.nome} e quero saber mais sobre o catálogo 3D.${assinatura(marca)}`)}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="grid size-11 place-items-center rounded-full border border-linho/20 transition hover:bg-linho hover:text-musgo"
            >
              <Whatsapp />
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-5 text-linho/45">{proprio ? `Catálogo ${marca.nome}` : 'Demonstração'}</p>
          <ul className="space-y-3 text-sm font-medium">
            {categorias.map((c) => (
              <li key={c}>
                <a href={hrefSecao('catalogo')} className="transition hover:text-linho">
                  {c}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-5 text-linho/45">O produto</p>
          <ul className="space-y-3 text-sm font-medium">
            <li>
              <a href={hrefSecao('sobre')} className="transition hover:text-linho">
                Benefícios
              </a>
            </li>
            <li>
              <a href={hrefSecao('ambientes')} className="transition hover:text-linho">
                Para quem é
              </a>
            </li>
            <li>
              <a href={hrefSecao('monte-seu-ambiente')} className="transition hover:text-linho">
                Ambiente 3D
              </a>
            </li>
            <li>
              <a href={hrefSecao('realidade-aumentada')} className="transition hover:text-linho">
                Como funciona
              </a>
            </li>
          </ul>
        </div>

        <div className="col-span-2 md:col-span-1">
          <p className="eyebrow mb-5 text-linho/45">Fale com a {empresa.nome}</p>
          <p className="text-sm leading-7 font-medium">
            {empresa.atendimento}
            <br />
            {empresa.horario}
            <br />
            {empresa.email}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-5 md:px-8">
        <div className="flex flex-col justify-between gap-2 border-t border-linho/10 py-6 text-xs text-linho/45 sm:flex-row">
          <span>© 2026 {marca.nome}. Todos os direitos reservados.</span>
          <span>{proprio ? `Catálogo 3D e realidade aumentada por ${empresa.nome}` : empresa.slogan}</span>
        </div>
      </div>
    </footer>
  )
}
