import type { ModelViewerElement } from '@google/model-viewer'
import QRCode from 'qrcode'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AdicionarAmbiente } from '../components/AdicionarAmbiente'
import { CardMovel } from '../components/CardMovel'
import { FotoMovel } from '../components/FotoMovel'
import { Camera, Cubo, Expandir, Fechar, Seta, Voltar, Whatsapp } from '../components/Icones'
import { SeletorCores } from '../components/SeletorCores'
import { Visualizador3D } from '../components/Visualizador3D'
import { alternarGavetas } from '../lib/modelo3d'
import { empresa, linkCelular, linkWhatsapp } from '../config'
import { foto, moveis, type Movel } from '../data/moveis'
import { assinatura, temNomeProprio, useMarca } from '../lib/marca'
import { hrefSecao } from '../router'

const container = 'mx-auto max-w-[1400px] px-5 md:px-8'

export function DetalheMovel({ movel }: { movel: Movel }) {
  const [cor, setCor] = useState(0)
  const [complemento, setComplemento] = useState(0)
  const [foco, setFoco] = useState(0)
  const [telaCheia, setTelaCheia] = useState(false)
  const [qrAberto, setQrAberto] = useState(false)
  const viewer = useRef<ModelViewerElement>(null)
  const marca = useMarca()
  const proprio = temNomeProprio(marca)
  const corAtual = movel.cores[cor]
  const complementoAtual = movel.complemento?.opcoes[complemento]
  const nomeEscolha = complementoAtual ? `${corAtual.nome} · ${complementoAtual.nome}` : corAtual.nome
  const fotos = [movel.imagem, ...movel.galeria]

  const verNoEspaco = () => {
    const mv = viewer.current
    if (mv?.canActivateAR) mv.activateAR()
    else setQrAberto(true)
  }

  useEffect(() => {
    if (!telaCheia && !qrAberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setTelaCheia(false)
      setQrAberto(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', aoTeclar)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', aoTeclar)
    }
  }, [telaCheia, qrAberto])

  const relacionados = [
    ...moveis.filter((m) => m.slug !== movel.slug && m.categoria === movel.categoria),
    ...moveis.filter((m) => m.slug !== movel.slug && m.categoria !== movel.categoria),
  ].slice(0, 3)

  return (
    <>
      <section className={`${container} pt-5 pb-14 md:pt-8 md:pb-20`}>
        <nav className="flex min-w-0 items-center gap-2 text-sm font-medium text-pedra">
          <a
            href={hrefSecao('catalogo')}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-tinta/10 px-4 py-2 transition hover:border-tinta/40 hover:text-tinta"
          >
            <Voltar className="size-4" /> {proprio ? `Catálogo ${marca.nome}` : 'Demonstração'}
          </a>
          <span className="hidden px-1 text-tinta/25 sm:inline">/</span>
          <span className="hidden sm:inline">{movel.categoria}</span>
          <span className="px-1 text-tinta/25">/</span>
          <span className="truncate font-semibold text-tinta">{movel.nome}</span>
        </nav>

        <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-[20px] bg-musgo px-5 py-4 text-linho sm:flex-row sm:items-center">
          <p className="flex items-center gap-3 text-sm font-semibold">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-destaque-claro" />
            {proprio
              ? `Você está na demonstração: é assim que o cliente da loja ${marca.nome} vai ver cada peça.`
              : 'Você está na demonstração: é assim que o seu cliente vai ver cada peça da sua loja.'}
          </p>
          <a
            href={hrefSecao('contato')}
            className="botao group shrink-0 bg-linho py-2.5 text-musgo hover:bg-creme"
          >
            Quero no meu site <Seta className="size-4 transition group-hover:translate-x-0.5" />
          </a>
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          {/* Na tela cheia a coluna sai do sticky/animação, que prenderiam o "fixed" e o z-index dentro dela. */}
          <div className={telaCheia ? 'relative z-50' : 'animar-surgir lg:sticky lg:top-24 lg:self-start'}>
            {movel.modelo ? (
              <div
                className={
                  telaCheia
                    ? 'fixed inset-0 z-50 bg-estudio'
                    : 'relative aspect-[4/5] overflow-hidden rounded-[28px] sm:aspect-[5/4]'
                }
              >
                <Visualizador3D movel={movel} cor={cor} complemento={complemento} refViewer={viewer}>
                  {/* Interface da sessão de RA: o model-viewer usa este botão para sair. */}
                  <button
                    type="button"
                    slot="exit-webxr-ar-button"
                    aria-label="Sair da realidade aumentada"
                    className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 grid size-14 cursor-pointer place-items-center rounded-2xl bg-linho/90 text-tinta shadow-xl backdrop-blur-md"
                  >
                    <Fechar className="size-6" />
                  </button>

                  <div className="so-ra absolute top-[max(1rem,env(safe-area-inset-top))] right-4 left-[5.25rem] h-14 items-center justify-between gap-3 rounded-2xl bg-linho/90 px-4 shadow-xl backdrop-blur-md">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold tracking-wide text-terracota uppercase">
                        {proprio ? `${marca.nome} · RA` : 'Ao vivo · RA'}
                      </p>
                      <p className="truncate font-display text-lg leading-tight">{movel.nome}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-musgo px-2.5 py-1 text-[10px] font-bold text-linho">1:1</span>
                  </div>

                  <div className="so-ra absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex-col gap-4 rounded-[26px] bg-linho/90 p-4 shadow-xl backdrop-blur-md">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold">Cor</p>
                        <p className="truncate text-xs font-semibold text-pedra">{corAtual.nome}</p>
                      </div>
                      <div className="mt-3">
                        <SeletorCores cores={movel.cores} selecionada={cor} onSelecionar={setCor} tamanho="g" />
                      </div>
                    </div>
                    {movel.complemento && complementoAtual && (
                      <div className="border-t border-tinta/10 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold">{movel.complemento.rotulo}</p>
                          <p className="truncate text-xs font-semibold text-pedra">{complementoAtual.nome}</p>
                        </div>
                        <div className="mt-3">
                          <SeletorCores
                            cores={movel.complemento.opcoes}
                            selecionada={complemento}
                            onSelecionar={setComplemento}
                            tamanho="g"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Visualizador3D>

                <span className="pointer-events-none absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-linho/90 px-3.5 py-2 text-xs font-bold backdrop-blur">
                  <Cubo className="size-4 text-terracota" /> 3D ·{' '}
                  {movel.modelo.dica ?? (movel.modelo.gavetas ? 'Gire e toque nas gavetas' : 'Arraste para girar')}
                </span>
                {movel.modelo.dica && movel.modelo.gavetas && (
                  <button
                    type="button"
                    onClick={() => viewer.current && alternarGavetas(viewer.current, movel.modelo!.gavetas!)}
                    className="absolute top-16 left-4 cursor-pointer rounded-full bg-musgo px-3.5 py-2 text-xs font-bold text-linho shadow-lg transition hover:bg-musgo-escuro"
                  >
                    Abrir / fechar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTelaCheia((v) => !v)}
                  aria-label={telaCheia ? 'Fechar tela cheia' : 'Ver em tela cheia'}
                  className="absolute top-4 right-4 grid size-11 cursor-pointer place-items-center rounded-full bg-linho/90 shadow-lg backdrop-blur transition hover:bg-linho"
                >
                  {telaCheia ? <Fechar className="size-5" /> : <Expandir className="size-5" />}
                </button>

                {telaCheia && (
                  <div className="absolute inset-x-4 bottom-6 mx-auto flex max-w-md flex-col items-center gap-3 rounded-[24px] bg-linho/90 p-4 shadow-xl backdrop-blur-md">
                    <div className="flex w-full items-center justify-between">
                      <p className="font-display text-xl">{movel.nome}</p>
                      <p className="text-sm font-semibold text-pedra">{nomeEscolha}</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-3">
                      <SeletorCores cores={movel.cores} selecionada={cor} onSelecionar={setCor} tamanho="g" />
                      {movel.complemento && (
                        <SeletorCores
                          cores={movel.complemento.opcoes}
                          selecionada={complemento}
                          onSelecionar={setComplemento}
                          tamanho="g"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={verNoEspaco}
                      className="botao mt-1 w-full cursor-pointer bg-terracota text-linho hover:bg-terracota-escuro"
                    >
                      <Camera className="size-4" /> Ver no meu espaço
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {foco === 0 ? (
                  <FotoMovel
                    imagem={movel.imagem}
                    cor={corAtual}
                    original={cor === 0}
                    alt={`${movel.nome} na cor ${corAtual.nome}`}
                    largura={1800}
                    enquadramento={movel.enquadramento}
                    className="aspect-[4/5] rounded-[28px] sm:aspect-[5/4]"
                  />
                ) : (
                  <img
                    src={foto(fotos[foco], 1800)}
                    alt={`${movel.nome} em ambiente`}
                    className="aspect-[4/5] w-full rounded-[28px] object-cover sm:aspect-[5/4]"
                  />
                )}

                <div className="mt-3 grid grid-cols-4 gap-3">
                  {fotos.map((id, i) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFoco(i)}
                      aria-label={`Ver foto ${i + 1}`}
                      className={`cursor-pointer overflow-hidden rounded-2xl transition ${
                        foco === i ? 'ring-2 ring-musgo ring-offset-2 ring-offset-linho' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {i === 0 ? (
                        <FotoMovel
                          imagem={id}
                          cor={corAtual}
                          original={cor === 0}
                          alt=""
                          largura={300}
                          enquadramento={movel.enquadramento}
                          className="aspect-square"
                        />
                      ) : (
                        <img src={foto(id, 300)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="animar-surgir [animation-delay:120ms]">
            <span className="inline-flex items-center gap-2 rounded-full bg-creme px-4 py-2 text-xs font-bold">
              <span className="size-1.5 rounded-full bg-terracota" />
              {proprio && `${marca.nome} · `}
              {movel.categoria} · {movel.linha}
            </span>
            <h1 className="mt-5 text-[44px] leading-[0.95] sm:mt-6 sm:text-[56px] md:text-[76px]">{movel.nome}</h1>
            <p className="mt-4 text-base leading-relaxed font-medium text-pedra sm:mt-5 sm:text-lg">{movel.resumo}</p>

            <div className="mt-7 rounded-[20px] bg-creme p-5 sm:mt-8 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Cor</p>
                <p className="text-sm font-semibold text-pedra">
                  {corAtual.nome}
                  {movel.cores.length > 1 && ` · ${cor + 1} de ${movel.cores.length}`}
                </p>
              </div>
              <div className="mt-4">
                <SeletorCores
                  cores={movel.cores}
                  selecionada={cor}
                  onSelecionar={(i) => {
                    setCor(i)
                    setFoco(0)
                  }}
                  tamanho="g"
                />
              </div>
              {movel.complemento && complementoAtual && (
                <>
                  <div className="mt-6 flex items-center justify-between border-t border-tinta/10 pt-5">
                    <p className="text-sm font-bold">{movel.complemento.rotulo}</p>
                    <p className="text-sm font-semibold text-pedra">
                      {complementoAtual.nome} · {complemento + 1} de {movel.complemento.opcoes.length}
                    </p>
                  </div>
                  <div className="mt-4">
                    <SeletorCores
                      cores={movel.complemento.opcoes}
                      selecionada={complemento}
                      onSelecionar={setComplemento}
                      tamanho="g"
                    />
                  </div>
                </>
              )}
            </div>

            <p className="mt-8 leading-relaxed text-tinta/80">{movel.descricao}</p>

            <dl className="mt-8 grid gap-3 sm:grid-cols-2">
              <Ficha rotulo="Medidas">{movel.dimensoes}</Ficha>
              <Ficha rotulo="Materiais">{movel.materiais.join(', ')}</Ficha>
            </dl>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <BotaoExperiencia
                icone={<Cubo />}
                rotulo="Ver em 3D"
                disponivel={!!movel.modelo}
                onClick={() => setTelaCheia(true)}
              />
              <BotaoExperiencia
                icone={<Camera />}
                rotulo="Ver no meu espaço"
                disponivel={!!movel.modelo}
                destaque
                onClick={verNoEspaco}
              />
            </div>
            <AdicionarAmbiente movel={movel} cor={cor} />
            {movel.modelo && (
              <p className="mt-3 text-sm text-pedra">
                Em tamanho real e na cor escolhida. No computador, mostramos um QR code para abrir no celular.
              </p>
            )}

            <a
              href={linkWhatsapp(
                `Olá! Testei a demonstração do catálogo 3D da ${empresa.nome} e quero isso para os móveis da minha loja.${assinatura(marca)}`,
              )}
              target="_blank"
              rel="noreferrer"
              className="botao mt-3 w-full bg-musgo py-4 text-linho hover:bg-musgo-escuro"
            >
              <Whatsapp className="size-4" /> Quero este catálogo 3D na minha loja
            </a>

           
          </div>
        </div>
      </section>

      {qrAberto && <ModalQR nome={movel.nome} cor={nomeEscolha} aoFechar={() => setQrAberto(false)} />}

      <section className="bg-creme py-14 md:py-24">
        <div className={container}>
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end sm:gap-6">
            <h2 className="text-[36px] leading-none sm:text-[40px] md:text-[56px]">Teste outras peças</h2>
            <a href={hrefSecao('catalogo')} className="botao group shrink-0 border border-tinta/20 hover:bg-linho">
              Ver demonstração <Seta className="size-4 transition group-hover:translate-x-0.5" />
            </a>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-12 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-3">
            {relacionados.map((m) => (
              <CardMovel key={m.slug} movel={m} aspecto="aspect-[5/4]" />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function Ficha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-tinta/10 p-5">
      <dt className="text-xs font-bold tracking-wide text-pedra uppercase">{rotulo}</dt>
      <dd className="mt-2 font-semibold">{children}</dd>
    </div>
  )
}

type PropsBotao = {
  icone: ReactNode
  rotulo: string
  disponivel: boolean
  destaque?: boolean
  onClick: () => void
}

function BotaoExperiencia({ icone, rotulo, disponivel, destaque, onClick }: PropsBotao) {
  return (
    <button
      type="button"
      disabled={!disponivel}
      onClick={onClick}
      className={`botao relative py-4 enabled:cursor-pointer disabled:border disabled:border-tinta/15 disabled:text-tinta/40 ${
        destaque
          ? 'enabled:bg-terracota enabled:text-linho enabled:hover:bg-terracota-escuro'
          : 'border border-tinta/15 enabled:hover:border-tinta'
      }`}
    >
      {icone}
      {rotulo}
      {!disponivel && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-terracota px-2 py-0.5 text-[10px] font-bold text-linho">
          Em breve
        </span>
      )}
    </button>
  )
}

function ModalQR({ nome, cor, aoFechar }: { nome: string; cor: string; aoFechar: () => void }) {
  const [qr, setQr] = useState<string>()

  useEffect(() => {
    QRCode.toDataURL(linkCelular(), {
      margin: 1,
      width: 520,
      color: { dark: '#1c1e1a', light: '#fbf9f5' },
    }).then(setQr)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-tinta/50 p-5 backdrop-blur-sm"
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Ver no meu espaço"
    >
      <div
        className="relative w-full max-w-md rounded-[28px] bg-linho p-8 text-center shadow-2xl animar-surgir"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="absolute top-4 right-4 grid size-10 cursor-pointer place-items-center rounded-full bg-creme"
        >
          <Fechar className="size-5" />
        </button>
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-creme text-terracota">
          <Camera className="size-6" />
        </span>
        <h2 className="mt-5 text-[34px] leading-tight">Abra no seu celular</h2>
        <p className="mt-3 text-pedra">
          Aponte a câmera para o QR code e veja {nome} na cor {cor}, em tamanho real, no seu ambiente.
        </p>
        <div className="mx-auto mt-6 aspect-square w-56 overflow-hidden rounded-2xl border border-tinta/10 bg-linho p-3">
          {qr && <img src={qr} alt="QR code para abrir esta página no celular" className="h-full w-full" />}
        </div>
        <p className="mt-5 text-xs font-semibold text-pedra">Funciona em iPhone e em Android com suporte a RA.</p>
      </div>
    </div>
  )
}

export function MovelNaoEncontrado() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-32 text-center">
      <p className="eyebrow text-terracota">Ops</p>
      <h1 className="mt-4 text-[56px] leading-none">Não encontramos esta peça.</h1>
      <a href={hrefSecao('catalogo')} className="botao mt-10 bg-musgo text-linho">
        Voltar ao catálogo
      </a>
    </section>
  )
}
