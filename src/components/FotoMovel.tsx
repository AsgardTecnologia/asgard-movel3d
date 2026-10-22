import { foto, type Cor } from '../data/moveis'

type Props = {
  imagem: string
  cor?: Cor
  /** A primeira cor do móvel é a da foto original, então não recebe tom. */
  original?: boolean
  alt: string
  largura?: number
  enquadramento?: string
  className?: string
  /** Sem o fundo das peças, para o móvel ficar direto sobre o que estiver atrás (os renders são transparentes). */
  fundo?: boolean
}

export function FotoMovel({ imagem, cor, original, alt, largura = 900, enquadramento, className = '', fundo = true }: Props) {
  const src = foto(cor?.imagem ?? imagem, largura)
  const aplicarTom = cor && !original && !cor.imagem

  return (
    <div className={`relative overflow-hidden ${fundo ? 'bg-estudio' : ''} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        style={{ objectPosition: enquadramento }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-color transition-opacity duration-500"
        style={{ backgroundColor: cor?.hex, opacity: aplicarTom ? 0.75 : 0 }}
      />
    </div>
  )
}
