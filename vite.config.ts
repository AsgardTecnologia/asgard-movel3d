import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'node:os'
import { defineConfig, loadEnv } from 'vite'

const porta = 5173

/** IPv4 do PC na rede (Wi-Fi/cabo), ignorando adaptadores virtuais como o do WSL. */
function ipDaRede() {
  for (const [nome, enderecos] of Object.entries(networkInterfaces())) {
    if (/vEthernet|WSL|Bluetooth|VirtualBox|VMware/i.test(nome)) continue
    const ip = enderecos?.find((e) => e.family === 'IPv4' && !e.internal)
    if (ip) return ip.address
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run dev:https`: certificado autoassinado, porque a RA (WebXR) no celular só funciona em HTTPS.
  const https = mode === 'https'
  // O QR code usa VITE_URL_PUBLICA, se definida; senão, o IP atual do PC na rede.
  const ip = ipDaRede()
  const urlPublica =
    loadEnv(mode, process.cwd()).VITE_URL_PUBLICA ?? (ip && `${https ? 'https' : 'http'}://${ip}:${porta}/`)

  return {
    plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
    define: { 'import.meta.env.VITE_URL_PUBLICA': JSON.stringify(urlPublica ?? '') },
    // Escuta na rede para o celular abrir o site pelo QR code.
    server: { host: true, port: porta, strictPort: true, allowedHosts: true },
  }
})
