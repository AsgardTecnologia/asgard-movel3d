export const empresa = {
  nome: 'Vitrine 3D',
  slogan: 'Catálogo 3D e realidade aumentada para lojas de móveis',
  whatsapp: '5500000000000',
  instagram: 'https://instagram.com/',
  email: 'contato@vitrine3d.com.br',
  atendimento: 'Atendimento em todo o Brasil',
  horario: 'Seg a Sex · 9h às 18h',
}

/**
 * Link do QR code. Aberto em localhost, troca pelo endereço público (VITE_URL_PUBLICA), que o celular
 * alcança. `parametros` vão no endereço (antes do #): o que a pessoa escolheu e o pedido de abrir a RA.
 */
export const linkCelular = (parametros?: Record<string, string>) => {
  const { hostname, pathname, search, hash, href } = window.location
  const base = import.meta.env.VITE_URL_PUBLICA
  const local = hostname === 'localhost' || hostname === '127.0.0.1'
  const url = new URL(base && local ? new URL(pathname + search + hash, base).href : href)
  for (const [k, v] of Object.entries(parametros ?? {})) url.searchParams.set(k, v)
  return url.href
}

export const linkWhatsapp = (mensagem: string) =>
  `https://wa.me/${empresa.whatsapp}?text=${encodeURIComponent(mensagem)}`
