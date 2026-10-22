import math
import numpy as np
from ficus2 import normalize
# ---------------------------------------------------------------- oclusão ambiente por mapas de profundidade
def bake_ao(P, N, F, n_dirs=160, res=900, bias=0.006):
    """Para cada direção do hemisfério de cada vértice, testa se há geometria à frente
    usando um mapa de profundidade ortográfico (máximo ao longo da direção)."""
    tri = P[F]
    occ_pts = np.vstack([P, tri.mean(1), (tri[:, 0] + tri[:, 1]) / 2, (tri[:, 1] + tri[:, 2]) / 2,
                         (tri[:, 2] + tri[:, 0]) / 2])
    i = np.arange(n_dirs) + 0.5
    phi = np.arccos(1 - 2 * i / n_dirs)
    th = math.pi * (1 + 5 ** 0.5) * i
    dirs = np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)
    vis = np.zeros(len(P)); wsum = np.zeros(len(P))
    Pq = P + N * 0.003
    ext = 1.6
    px = 2 * ext / res
    for d in dirs:
        cos = N @ d
        mask = cos > 0
        if not mask.any():
            continue
        a = normalize(np.cross(d, [0, 0, 1.] if abs(d[2]) < 0.9 else [1, 0, 0.]))
        b = np.cross(d, a)
        def pix(X):
            u = np.clip(((X @ a + ext) / px).astype(int), 0, res - 1)
            v = np.clip(((X @ b + ext) / px).astype(int), 0, res - 1)
            return u * res + v
        dm = np.full(res * res, -np.inf)
        np.maximum.at(dm, pix(occ_pts), occ_pts @ d)
        dm = dm.reshape(res, res)
        # dilata 3x3 para fechar buracos entre pontos
        pad = np.pad(dm, 1, constant_values=-np.inf)
        dm = np.max(np.stack([pad[i:i + res, j:j + res] for i in range(3) for j in range(3)]), 0).reshape(-1)
        Q = Pq[mask]
        c = cos[mask]
        blocked = dm[pix(Q)] > Q @ d + bias + 0.012 * np.sqrt(np.clip(1 - c * c, 0, 1))
        if d[1] < -0.05:
            blocked |= (Q[:, 1] / -d[1]) < 0.25    # chão próximo
        vis[mask] += c * (~blocked)
        wsum[mask] += c
    return vis / np.maximum(wsum, 1e-9)

