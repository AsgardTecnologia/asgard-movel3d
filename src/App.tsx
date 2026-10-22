import { lazy, Suspense, useEffect } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { BotaoPersonalizar, PainelPersonalizar } from './components/Personalizar'
import { buscarMovel } from './data/moveis'
import { DetalheMovel, MovelNaoEncontrado } from './pages/DetalheMovel'
import { Inicio } from './pages/Inicio'
import { useRota } from './router'

// O ambiente carrega o three.js; só baixa quando a pessoa abre a página.
const Ambiente = lazy(() => import('./pages/Ambiente').then((m) => ({ default: m.Ambiente })))

function App() {
  const rota = useRota()
  const movel = rota.pagina === 'movel' ? buscarMovel(rota.slug) : undefined

  useEffect(() => {
    if (rota.pagina === 'inicio' && rota.secao) {
      document.getElementById(rota.secao)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0 })
    }
  }, [rota])

  return (
    <>
      <Header />
      <main>
        {rota.pagina === 'inicio' && <Inicio />}
        {rota.pagina === 'movel' && (movel ? <DetalheMovel key={movel.slug} movel={movel} /> : <MovelNaoEncontrado />)}
        {rota.pagina === 'ambiente' && (
          <Suspense fallback={<div className="h-[70svh]" />}>
            <Ambiente />
          </Suspense>
        )}
      </main>
      <Footer />
      {rota.pagina !== 'ambiente' && <BotaoPersonalizar />}
      <PainelPersonalizar />
    </>
  )
}

export default App
