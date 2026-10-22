import type { Cor } from '../data/moveis'

type Props = {
  cores: Cor[]
  selecionada: number
  onSelecionar: (indice: number) => void
  tamanho?: 'p' | 'g'
}

export function SeletorCores({ cores, selecionada, onSelecionar, tamanho = 'p' }: Props) {
  const dim = tamanho === 'g' ? 'size-10' : 'size-5'

  return (
    <div className={`flex flex-wrap items-center ${tamanho === 'g' ? 'gap-3' : 'gap-1.5'}`} role="radiogroup" aria-label="Cores disponíveis">
      {cores.map((cor, i) => {
        const ativa = i === selecionada
        return (
          <button
            key={cor.nome}
            type="button"
            role="radio"
            aria-checked={ativa}
            aria-label={cor.nome}
            title={cor.nome}
            onClick={() => onSelecionar(i)}
            className={`${dim} cursor-pointer rounded-full border-2 transition duration-200 ${
              ativa ? 'scale-110 border-linho ring-[1.5px] ring-tinta' : 'border-linho ring-1 ring-tinta/15 hover:ring-tinta/50'
            }`}
            style={{
              backgroundColor: cor.hex,
              backgroundImage: cor.hex2 ? `linear-gradient(135deg, ${cor.hex} 50%, ${cor.hex2} 50%)` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
