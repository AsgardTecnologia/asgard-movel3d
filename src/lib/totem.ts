/**
 * Modo totem: tela grande de toque (em pé ou deitada), uso público na loja.
 * Liga com `?totem=1` na URL (orientação pela tela), `?totem=v` (sempre em pé) ou `?totem=h` (sempre
 * deitado); fica guardado no aparelho e `?totem=0` desliga. Sem pedido, liga sozinho numa tela grande de
 * toque. Põe no <html> a classe `totem` e mais `totem-v` ou `totem-h`, que ativam as variantes do CSS.
 */
const CHAVE = 'totem'

type Modo = 'auto' | 'v' | 'h'

const guardado = () => {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

const guardar = (v: string) => {
  try {
    localStorage.setItem(CHAVE, v)
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
}

const lerModo = (v: string | null): Modo | null =>
  v === 'v' || v === 'h' ? v : v === '1' || v === '' ? 'auto' : null

function detectar(): Modo | null {
  const pedido = new URLSearchParams(location.search).get('totem')
  if (pedido != null) {
    const modo = pedido === '0' ? null : (lerModo(pedido) ?? 'auto')
    guardar(modo ?? '0')
    return modo
  }
  const salvo = guardado()
  if (salvo != null) return lerModo(salvo)
  // Tela grande de toque. Totens costumam usar escala de 150% no Windows (1080×1920 vira 720×1280),
  // por isso o limite é baixo; monitor comum de computador não tem toque.
  const toque = matchMedia('(pointer: coarse)').matches
  const emPe = matchMedia('(orientation: portrait) and (min-width: 700px) and (min-height: 1200px)').matches
  const deitado = matchMedia('(orientation: landscape) and (min-width: 1200px)').matches
  return toque && (emPe || deitado) ? 'auto' : null
}

const modo = detectar()

export const totem = modo != null

const retrato = matchMedia('(orientation: portrait)')

/**
 * Totem em pé pedido num monitor deitado (`?totem=v` no computador): mostra o app numa moldura 9:16
 * (1080×1920, reduzida) no meio da tela. Dentro da moldura a tela já é em pé.
 * Devolve `true` quando montou a moldura (aí o app não roda nesta página, só dentro dela).
 */
export function emolduraTotem() {
  if (modo !== 'v' || retrato.matches || window.self !== window.top) return false
  const quadro = document.createElement('iframe')
  quadro.src = location.href
  quadro.title = 'Totem'
  // Desenha em 1080×1920 (o tamanho de um totem) e reduz para caber na altura do monitor.
  quadro.style.cssText =
    'position:absolute;top:0;left:50%;width:1080px;height:1920px;border:0;transform-origin:top left;box-shadow:0 0 0 2px #0004,0 40px 120px #0008'
  const encaixar = () => {
    const escala = innerHeight / 1920
    quadro.style.transform = `translateX(${-540 * escala}px) scale(${escala})`
  }
  encaixar()
  addEventListener('resize', encaixar)
  document.body.style.cssText = 'margin:0;height:100vh;background:#1c1f1b;overflow:hidden;position:relative'
  document.body.replaceChildren(quadro)
  return true
}

export function aplicarTotem() {
  const html = document.documentElement
  const aplicar = () => {
    const emPe = modo === 'v' || (modo === 'auto' && retrato.matches)
    html.classList.toggle('totem', totem)
    html.classList.toggle('totem-v', totem && emPe)
    html.classList.toggle('totem-h', totem && !emPe)
  }
  aplicar()
  if (modo === 'auto') retrato.addEventListener('change', aplicar)
}

/** Sem toque por este tempo, o totem volta para a tela de descanso e começa do zero para o próximo cliente. */
export const OCIOSO_MS = 120_000
