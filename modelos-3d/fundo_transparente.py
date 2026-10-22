"""Tira o fundo bege dos renders e mantém a sombra como transparência, para o fundo poder mudar de cor no site.

Uso: python modelos-3d/fundo_transparente.py <pasta com os .webp originais> <pasta de saída>
Os originais (fundo #ebe6dc) ficam em modelos-3d/renders-fundo-bege.

Como funciona: a partir das bordas da imagem (e de todo pixel igual ao fundo), cresce uma região de pixels que
parecem fundo ou sombra (o bege escurecido por igual nos três canais) sem cruzar uma borda nítida (contorno do móvel).
Nessa região o pixel vira preto com alfa = quanto ele escureceu o bege; o resto é o móvel, opaco.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

FUNDO = np.array([235, 230, 220], dtype=np.float32)

# Peças em tons próximos do bege (couro off-white, vaso branco) se confundem com a sombra. Como todas as cores
# de uma peça saem da mesma câmera, elas usam o recorte de uma cor escura da mesma peça.
REFERENCIA = {'poltrona-couro-3': 'poltrona-couro-0', 'vaso-ficus-1': 'vaso-ficus-0'}
# A cúpula bege do abajur aparece em todas as cores: o recorte vem de um render à parte com a cúpula escura.
REFERENCIA |= {f'abajur-madeira-{i}': 'abajur-madeira-recorte' for i in range(3)}


def ler(arq: Path) -> np.ndarray:
    return np.asarray(Image.open(arq).convert('RGB'), dtype=np.float32)


def expandir(m: np.ndarray) -> np.ndarray:
    d = m.copy()
    d[1:, :] |= m[:-1, :]
    d[:-1, :] |= m[1:, :]
    d[:, 1:] |= m[:, :-1]
    d[:, :-1] |= m[:, 1:]
    return d


def fundo_e_sombra(img: np.ndarray) -> np.ndarray:
    """Máscara dos pixels que são fundo ou sombra (não móvel)."""
    razao = img / FUNDO
    k = razao.mean(axis=2)
    neutro = np.abs(razao - k[..., None]).max(axis=2) < 0.035
    parece_sombra = neutro & (k > 0.45) & (k < 1.03)

    # Contorno nítido do móvel: diferença grande para um vizinho.
    lum = img.mean(axis=2)
    grad = np.zeros_like(lum)
    dy, dx = np.abs(np.diff(lum, axis=0)), np.abs(np.diff(lum, axis=1))
    grad[1:, :] = np.maximum(grad[1:, :], dy)
    grad[:-1, :] = np.maximum(grad[:-1, :], dy)
    grad[:, 1:] = np.maximum(grad[:, 1:], dx)
    grad[:, :-1] = np.maximum(grad[:, :-1], dx)
    permitido = parece_sombra & (grad < 18)

    regiao = permitido & (k > 0.95)
    for borda in (np.s_[0, :], np.s_[-1, :], np.s_[:, 0], np.s_[:, -1]):
        regiao[borda] |= permitido[borda]
    while True:
        cresce = expandir(regiao) & permitido
        if (cresce == regiao).all():
            return regiao
        regiao = cresce


def processar(origem: Path, destino: Path) -> None:
    img = ler(origem)
    ref = REFERENCIA.get(origem.stem)
    regiao = fundo_e_sombra(ler(origem.with_name(f'{ref}.webp')) if ref else img)
    k = (img / FUNDO).mean(axis=2)

    saida = np.zeros((*img.shape[:2], 4), dtype=np.float32)
    saida[..., :3] = img
    saida[..., 3] = 255
    saida[regiao, :3] = 0
    saida[regiao, 3] = np.clip(1 - k[regiao], 0, 1) * 255

    # Anel de 2 px do contorno: o pixel é móvel misturado com o fundo; recupera a cor e o alfa dessa mistura.
    anel = expandir(expandir(regiao)) & ~regiao
    a = np.clip(np.abs(img - FUNDO).max(axis=2) / 60, 0.35, 1)
    cor = FUNDO + (img - FUNDO) / a[..., None]
    saida[anel, :3] = np.clip(cor[anel], 0, 255)
    saida[anel, 3] = a[anel] * 255

    destino.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(saida.round().astype(np.uint8), 'RGBA').save(destino, 'WEBP', quality=90, alpha_quality=90, method=6)


if __name__ == '__main__':
    entrada, saida = Path(sys.argv[1]), Path(sys.argv[2])
    for arq in sorted(entrada.glob('*.webp')):
        processar(arq, saida / arq.name)
        print(arq.name)
