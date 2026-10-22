export const empresa = {
  nome: 'Vitrine 3D',
  slogan: 'Catálogo 3D e realidade aumentada para lojas de móveis',
  whatsapp: '5500000000000',
  instagram: 'https://instagram.com/',
  email: 'contato@vitrine3d.com.br',
  atendimento: 'Atendimento em todo o Brasil',
  horario: 'Seg a Sex · 9h às 18h',
}

/** Link do QR code. Aberto em localhost, troca pelo endereço público (VITE_URL_PUBLICA), que o celular alcança. */
export const linkCelular = () => {
  const { hostname, pathname, search, hash, href } = window.location
  const base = import.meta.env.VITE_URL_PUBLICA
  const local = hostname === 'localhost' || hostname === '127.0.0.1'
  return base && local ? new URL(pathname + search + hash, base).href : href
}

export const linkWhatsapp = (mensagem: string) =>
  `https://wa.me/${empresa.whatsapp}?text=${encodeURIComponent(mensagem)}`
