import { useState } from 'react'
import { buscarMovel, type Movel } from '../data/moveis'
import { dominio, temNomeProprio, useMarca } from '../lib/marca'
import { hrefMovel } from '../router'
import { FotoMovel } from './FotoMovel'
import { Camera, Check, Cubo, Planta, Sacola } from './Icones'
import { SeletorCores } from './SeletorCores'

const sombra = 'shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35)]'

/** O móvel "posicionado" pela câmera: piso detectado, caixa com a medida real e o selo de RA. */
export function CenaRA({ movel, cor, medida, className = '' }: { movel: Movel; cor: number; medida: string; className?: string }) {
  const c = movel.cores[cor]

  return (
    <div className={`pointer-events-none relative overflow-hidden ${className}`}>
      <div
        aria-hidden
        className="absolute inset-x-[-40%] bottom-[-15%] h-[75%] origin-bottom opacity-[0.13] [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_68%)] [transform:perspective(900px)_rotateX(66deg)]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-tinta) 1px, transparent 1px), linear-gradient(90deg, var(--color-tinta) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="absolute top-1/2 left-1/2 w-[min(86%,560px)] -translate-x-1/2 -translate-y-1/2 md:top-[46%]">
        <img
          src={c.imagem ?? movel.imagem}
          alt={`${movel.nome} na cor ${c.nome}, posicionado em realidade aumentada`}
          className="aspect-square w-full transition-opacity duration-500 [mask-image:radial-gradient(ellipse_at_50%_55%,black_60%,transparent_75%)]"
        />
        <div className="absolute top-[19%] right-[4%] bottom-[17%] left-[7%] rounded-2xl border-2 border-dashed border-terracota/70">
          <span className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-tinta/85 px-3 py-1 text-[11px] font-bold whitespace-nowrap text-linho backdrop-blur">
            ← {medida} →
          </span>
          {['-top-1.5 -left-1.5', '-top-1.5 -right-1.5', '-bottom-1.5 -left-1.5', '-bottom-1.5 -right-1.5'].map((pos) => (
            <span key={pos} className={`absolute size-3 rounded-full border-2 border-linho bg-terracota ${pos}`} />
          ))}
        </div>
      </div>

      <span className="absolute top-6 right-6 inline-flex items-center gap-2 rounded-full bg-linho/90 px-4 py-2 text-xs font-bold shadow-lg backdrop-blur">
        <span className="size-2 animate-pulse rounded-full bg-terracota" /> Ao vivo · RA · 1:1
      </span>
    </div>
  )
}

/** Página de produto de uma loja qualquer, já com o 3D e o botão de RA. */
export function MockupLoja({ movel }: { movel: Movel }) {
  const [cor, setCor] = useState(0)
  const marca = useMarca()
  const c = movel.cores[cor]

  return (
    <div className="flex h-full items-center justify-center bg-estudio p-5 md:p-10">
      <div className={`w-full max-w-[580px] overflow-hidden rounded-[20px] bg-linho ${sombra}`}>
        <div className="flex items-center gap-1.5 border-b border-tinta/10 px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-tinta/15" />
          ))}
          <span className="ml-3 flex-1 truncate rounded-full bg-creme px-4 py-1.5 text-[11px] font-semibold text-pedra">
            {dominio(temNomeProprio(marca) ? marca.nome : '')}/{movel.slug}
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[1.25fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl bg-estudio">
            <img
              src={c.imagem ?? movel.imagem}
              alt={`${movel.nome} na cor ${c.nome}`}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-linho/90 px-2.5 py-1 text-[10px] font-bold backdrop-blur">
              <Cubo className="size-3.5 text-terracota" /> 3D · Arraste para girar
            </span>
          </div>

          <div className="flex flex-col">
            <p className="text-[10px] font-bold tracking-wide text-terracota uppercase">{movel.categoria}</p>
            <p className="mt-1 font-display text-[22px] leading-tight text-tinta">{movel.nome}</p>
            <span className="mt-3 h-2 w-full rounded-full bg-tinta/8" />
            <span className="mt-2 h-2 w-3/4 rounded-full bg-tinta/8" />
            <div className="mt-4">
              <SeletorCores cores={movel.cores} selecionada={cor} onSelecionar={setCor} />
            </div>
            <div className="mt-5 grid gap-2 sm:mt-auto">
              <span className="inline-flex items-center justify-center gap-2 rounded-full border border-tinta/15 px-4 py-2.5 text-xs font-bold text-tinta">
                <Cubo className="size-4" /> Ver em 3D
              </span>
              <span className="inline-flex items-center justify-center gap-2 rounded-full bg-terracota px-4 py-2.5 text-xs font-bold text-linho">
                <Camera className="size-4" /> Ver no meu espaço
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Conversa de WhatsApp em que o vendedor manda o link da peça em RA. */
export function MockupConversa({ movel }: { movel: Movel }) {
  const marca = useMarca()
  const nome = temNomeProprio(marca) ? marca.nome : 'Sua Loja'

  return (
    <div className="flex h-full items-center justify-center bg-estudio p-5 md:p-10">
      <div className={`w-full max-w-[400px] overflow-hidden rounded-[28px] bg-linho ${sombra}`}>
        <div className="flex items-center gap-3 bg-musgo px-5 py-4 text-linho">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-terracota font-display text-lg">
            {nome.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{nome} · Vendas</p>
            <p className="text-xs text-linho/60">online</p>
          </div>
        </div>

        <div className="space-y-3 bg-creme p-4 text-[13px] leading-snug text-tinta">
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-[color-mix(in_oklab,var(--color-musgo)_14%,var(--color-linho))] px-3.5 py-2.5">
            Oi, Ana! Separei a cadeira que você perguntou. Abre no celular e vê como fica no seu escritório:
          </div>

          <a
            href={hrefMovel(movel.slug)}
            className="ml-auto block max-w-[85%] overflow-hidden rounded-2xl rounded-tr-md bg-[color-mix(in_oklab,var(--color-musgo)_14%,var(--color-linho))] p-1.5 transition hover:brightness-[0.97]"
          >
            <img
              src={movel.imagem}
              alt={movel.nome}
              loading="lazy"
              className="aspect-[16/10] w-full rounded-xl bg-estudio object-cover object-[50%_45%]"
            />
            <div className="px-2 pt-2.5 pb-1.5">
              <p className="font-bold">{movel.nome}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-terracota">
                <Camera className="size-3.5" /> Ver no meu espaço · 3D e RA
              </p>
              <p className="mt-1 text-[11px] text-pedra">{dominio(temNomeProprio(marca) ? marca.nome : '')}</p>
            </div>
          </a>

          <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-linho px-3.5 py-2.5">
            Coube certinho do lado da mesa! Vou querer a preta 🙌
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Peças da sala de exemplo. Largura e posição em % do palco (4:3), calculadas pelas medidas reais
 * de cada peça para ficarem em escala entre si. Ordem = de trás para a frente.
 */
const pecasSala = [
  { slug: 'vaso-ficus', cor: 0, left: -6, top: 23, width: 33 },
  { slug: 'sofa-couro', cor: 2, left: 14, top: 23.6, width: 40 },
  { slug: 'mesinha-madeira', cor: 0, left: 52, top: 50.8, width: 15.5 },
  { slug: 'abajur-madeira', cor: 0, left: 56, top: 42, width: 7.6 },
  { slug: 'poltrona-couro', cor: 0, left: 62, top: 55.4, width: 29 },
].map((p) => ({ ...p, movel: buscarMovel(p.slug)! }))

/** O cômodo que o cliente montou com as peças da loja, ao lado da lista pronta para comprar de uma vez. */
export function MockupAmbiente() {
  const marca = useMarca()

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#b9c4ae]">
        <div aria-hidden className="absolute inset-x-0 top-[62%] h-[2.2%] bg-[#f3eee6]/80" />
        <div
          aria-hidden
          className="absolute inset-x-[-30%] top-[64%] bottom-[-40%] origin-top [transform:perspective(700px)_rotateX(58deg)]"
          style={{
            background:
              'repeating-linear-gradient(90deg, #b98a5a 0 3.4%, #a87b4e 3.4% 3.55%), linear-gradient(#b98a5a, #a87b4e)',
          }}
        />
        <div aria-hidden className="absolute inset-x-0 top-[64%] bottom-0 bg-gradient-to-b from-black/15 to-transparent" />
        <div aria-hidden className="absolute top-[71%] left-[17%] h-[15%] w-[56%] rounded-[50%] bg-[#ece4d6]/90 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)]" />
        <div aria-hidden className="absolute top-[17%] left-[25%] flex w-[19%] gap-[8%]">
          <span className="aspect-[3/4] flex-1 rounded-md border-[5px] border-[#f3eee6] bg-[linear-gradient(160deg,#c27a58_0_45%,#e6dccb_45%)] shadow-md" />
          <span className="aspect-[3/4] flex-1 rounded-md border-[5px] border-[#f3eee6] bg-[radial-gradient(circle_at_50%_60%,#5f6b56_0_30%,#e6dccb_31%)] shadow-md" />
        </div>

        {pecasSala.map((p) => {
          const c = p.movel.cores[p.cor]
          return (
            <img
              key={p.slug}
              src={c.imagem ?? p.movel.imagem}
              alt={`${p.movel.nome} na cor ${c.nome}`}
              loading="lazy"
              className="absolute aspect-[4/5]"
              style={{ left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%` }}
            />
          )
        })}

        <span className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-linho/90 px-3.5 py-2 text-[11px] font-bold shadow-lg backdrop-blur md:top-6 md:left-6 md:text-xs">
          <Planta className="size-4 text-terracota" /> Sala de estar · 4,2 × 3,6 m
        </span>
        <div className="absolute top-4 right-4 hidden items-center gap-2 rounded-full bg-linho/90 py-1.5 pr-3.5 pl-1.5 text-xs font-bold shadow-lg backdrop-blur sm:flex md:top-6 md:right-6">
          <span className="flex -space-x-1.5">
            {['#b9c4ae', '#b98a5a'].map((hex) => (
              <span key={hex} className="size-6 rounded-full border-2 border-linho" style={{ backgroundColor: hex }} />
            ))}
          </span>
          Parede sálvia · Piso carvalho
        </div>
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-tinta/80 px-3.5 py-2 text-[11px] font-bold text-linho backdrop-blur md:bottom-6 md:left-6 md:text-xs">
          <Cubo className="size-4" /> Arraste para girar o cômodo
        </span>
      </div>

      <div className={`flex flex-col rounded-[28px] bg-linho p-5 md:p-7 ${sombra}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-wide text-terracota uppercase">
              {temNomeProprio(marca) ? `Ambiente ${marca.nome}` : 'Seu ambiente'}
            </p>
            <p className="mt-1 font-display text-[26px] leading-tight">Sala de estar</p>
          </div>
          <span className="rounded-full bg-creme px-3 py-1.5 text-xs font-bold">{pecasSala.length} peças</span>
        </div>

        <ul className="mt-5 space-y-2">
          {pecasSala.map((p) => (
            <li key={p.slug}>
              <a href={hrefMovel(p.slug)} className="flex items-center gap-3 rounded-2xl p-1.5 transition hover:bg-creme">
                <FotoMovel
                  imagem={p.movel.imagem}
                  cor={p.movel.cores[p.cor]}
                  original={p.cor === 0}
                  alt=""
                  largura={160}
                  enquadramento={p.movel.enquadramento}
                  className="size-12 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.movel.nome}</p>
                  <p className="text-xs font-semibold text-pedra">{p.movel.cores[p.cor].nome}</p>
                </div>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-musgo text-linho">
                  <Check className="size-3.5" />
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-2 lg:mt-auto lg:pt-6">
          <span className="flex items-center justify-center gap-2 rounded-full bg-musgo px-4 py-3.5 text-sm font-bold text-linho">
            <Sacola className="size-4" /> Comprar o ambiente todo
          </span>
          <span className="flex items-center justify-center gap-2 rounded-full border border-tinta/15 px-4 py-3 text-xs font-bold">
            Enviar a lista para um vendedor
          </span>
        </div>
      </div>
    </div>
  )
}
