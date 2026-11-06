import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { DescansoTotem } from './components/DescansoTotem'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { BotaoPersonalizar, PainelPersonalizar } from './components/Personalizar'
import { buscarMovel } from './data/moveis'
import { DetalheMovel, MovelNaoEncontrado } from './pages/DetalheMovel'
import { Inicio } from './pages/Inicio'
import { lerConvite, limparConvite } from './lib/conviteRA'
import { totem } from './lib/totem'
import { useRota } from './router'

// O ambiente carrega o three.js; só baixa quando a pessoa abre a página.
const Ambiente = lazy(() => import('./pages/Ambiente').then((m) => ({ default: m.Ambiente })))
// Chegou pelo QR code do provador de piso/parede: também usa o three.js, só baixa nesse caso.
const ConviteAcabamento = lazy(() => import('./components/ConviteAcabamento'))

/** O convite do QR code para piso/parede (o do móvel fica com a página dele). Lido uma vez, na abertura. */
const conviteInicial = (() => {
  const c = lerConvite()
  if (c?.tipo !== 'piso' && c?.tipo !== 'parede') return null
  limparConvite()
  return c
})()

function App() {
  const rota = useRota()
  const [convite, setConvite] = useState(conviteInicial)
  const fecharConvite = useCallback(() => setConvite(null), [])
  const movel = rota.pagina === 'movel' ? buscarMovel(rota.slug) : undefined
  /** Foto de um ambiente pronto: só a cena, sem o site em volta. */
  const foto = rota.pagina === 'ambiente' && rota.foto

  useEffect(() => {
    if (rota.pagina === 'inicio' && rota.secao) {
      document.getElementById(rota.secao)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0 })
    }
  }, [rota])

  return (
    <>
      {!foto && <Header />}
      <main>
        {rota.pagina === 'inicio' && <Inicio />}
        {rota.pagina === 'movel' && (movel ? <DetalheMovel key={movel.slug} movel={movel} /> : <MovelNaoEncontrado />)}
        {rota.pagina === 'ambiente' && (
          <Suspense fallback={<div className="h-[70svh]" />}>
            <Ambiente pronto={rota.pronto} foto={rota.foto} />
          </Suspense>
        )}
      </main>
      {!foto && !totem && <Footer />}
      {rota.pagina !== 'ambiente' && !totem && <BotaoPersonalizar />}
      {totem && !foto && <DescansoTotem />}
      <PainelPersonalizar />
      {convite && (
        <Suspense fallback={null}>
          <ConviteAcabamento convite={convite} aoFechar={fecharConvite} />
        </Suspense>
      )}
    </>
  )
}

export default App
