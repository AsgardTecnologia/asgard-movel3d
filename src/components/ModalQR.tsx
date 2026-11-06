import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { linkCelular } from '../config'
import { Camera, Fechar } from './Icones'

/**
 * No computador, a RA abre no celular: QR code com o link desta página. `parametros` vão no link (a
 * escolha da pessoa e o pedido de abrir a câmera, ver `lib/conviteRA`).
 */
export function ModalQR({
  texto,
  parametros,
  aoFechar,
}: {
  texto: string
  parametros?: Record<string, string>
  aoFechar: () => void
}) {
  const [qr, setQr] = useState<string>()
  const link = linkCelular(parametros)

  useEffect(() => {
    QRCode.toDataURL(link, {
      margin: 1,
      // O link ficou maior (leva a escolha): correção média ainda lê bem de longe, na tela do totem.
      errorCorrectionLevel: 'M',
      width: 520,
      color: { dark: '#1c1e1a', light: '#fbf9f5' },
    }).then(setQr)
  }, [link])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-tinta/50 p-4 backdrop-blur-sm sm:p-5"
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Ver no meu espaço"
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[28px] bg-linho p-6 text-center shadow-2xl animar-surgir sm:p-8"
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
        <h2 className="mt-5 text-[28px] leading-tight sm:text-[34px]">Abra no seu celular</h2>
        <p className="mt-3 text-pedra">{texto}</p>
        <div className="mx-auto mt-6 aspect-square w-full max-w-56 overflow-hidden rounded-2xl border border-tinta/10 bg-linho p-3">
          {qr && <img src={qr} alt="QR code para abrir esta página no celular" className="h-full w-full" />}
        </div>
        <p className="mt-5 text-xs font-semibold text-pedra">Funciona em iPhone e em Android com suporte a RA.</p>
      </div>
    </div>
  )
}
