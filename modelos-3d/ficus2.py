"""Gera vaso-ficus.glb (v2, mais detalhado): Ficus elastica em vaso cônico preto
com raízes aparentes, casca de pinus, lascas finas e pedriscos.
Unidades em metros, Y para cima, base do vaso em y=0."""
import io, json, struct, math, sys
import numpy as np
from PIL import Image, ImageFilter

rng = np.random.default_rng(7)
OUT = sys.argv[1] if len(sys.argv) > 1 else None

TOTAL_H = 1.25
POT_H = 0.48
R_TOP = 0.19
R_BOT = 0.10
WALL = 0.011
MULCH_Y = POT_H - 0.035
UP = np.array([0, 1, 0.])

def r_out(y):
    return R_BOT + (R_TOP - R_BOT) * y / POT_H

R_IN_MULCH = r_out(MULCH_Y) - WALL - 0.003

# ---------------------------------------------------------------- utilidades
def normalize(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)

def vertex_normals(P, F):
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return normalize(N)

def orient(P, F, N):
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    avg = N[F[:, 0]] + N[F[:, 1]] + N[F[:, 2]]
    flip = (fn * avg).sum(1) < 0
    F = F.copy()
    F[flip] = F[flip][:, [0, 2, 1]]
    return F

def grid_faces(nu, nv, closed_v=False):
    i, j = np.mgrid[0:nu - 1, 0:(nv if closed_v else nv - 1)]
    j2 = (j + 1) % nv
    a, b, c, d = i * nv + j, i * nv + j2, (i + 1) * nv + j, (i + 1) * nv + j2
    return np.concatenate([np.stack([a, c, b], -1).reshape(-1, 3), np.stack([b, c, d], -1).reshape(-1, 3)])

def rot_axis(axis, ang):
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s, C = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[c + x*x*C, x*y*C - z*s, x*z*C + y*s],
                     [y*x*C + z*s, c + y*y*C, y*z*C - x*s],
                     [z*x*C - y*s, z*y*C + x*s, c + z*z*C]])

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

class Mesh:
    def __init__(self):
        self.P, self.N, self.UV, self.C, self.F = [], [], [], [], []
        self.n = 0
    def add(self, P, F, N=None, UV=None, C=None, fix=True):
        P = np.asarray(P, float)
        if N is None:
            N = vertex_normals(P, F)
        if fix:
            F = orient(P, F, N)
        if UV is None:
            UV = np.zeros((len(P), 2))
        if C is None:
            C = np.ones((len(P), 3))
        elif np.ndim(C) == 1:
            C = np.tile(C, (len(P), 1))
        self.P.append(P); self.N.append(N); self.UV.append(UV); self.C.append(np.asarray(C, float))
        self.F.append(F + self.n)
        self.n += len(P)
    def arrays(self):
        return (np.vstack(self.P), np.vstack(self.N), np.vstack(self.UV),
                np.vstack(self.C), np.vstack(self.F))

# ---------------------------------------------------------------- ruído e imagens
def fbm(shape, octaves=5, seed=0, base=4, tile=True):
    r = np.random.default_rng(seed)
    h, w = shape
    out = np.zeros(shape)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        f = base * 2 ** o
        small = r.random((f + 1, f + 1))
        if tile:
            small[-1, :] = small[0, :]
            small[:, -1] = small[:, 0]
        img = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * (np.asarray(img, float) / 255)
        tot += amp
        amp *= 0.5
    return out / tot

def stretch(arr, shape):
    return np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).resize(shape[::-1], Image.BICUBIC), float) / 255

def blur(arr, r):
    k = np.arange(-int(3 * r) - 1, int(3 * r) + 2)
    w = np.exp(-(k / r) ** 2 / 2)
    w /= w.sum()
    out = sum(wi * np.roll(arr, ki, 0) for ki, wi in zip(k, w))
    return sum(wi * np.roll(out, ki, 1) for ki, wi in zip(k, w))

def jpg(arr, q=90):
    b = io.BytesIO()
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(b, format='JPEG', quality=q, subsampling=0, optimize=True)
    return b.getvalue(), 'image/jpeg'

def normal_map(height, strength):
    gy, gx = np.gradient(height)
    n = np.dstack([-gx * strength, gy * strength, np.ones_like(height)])
    return (normalize(n) * 0.5 + 0.5) * 255

def mr_map(rough):
    return np.dstack([np.zeros_like(rough), rough, np.zeros_like(rough)]) * 255

# ---------------------------------------------------------------- texturas
LEAF_VARIANTS = 2

def leaf_textures(SU=2048, SV=1024):
    """Atlas com 2 variantes empilhadas em v. u: base->ponta, v: margem->margem."""
    cols, nms, mrs, bcols, bnms = [], [], [], [], []
    for var in range(LEAF_VARIANTS):
        sd = 100 + var * 10
        v, u = np.mgrid[0:SV // 2, 0:SU].astype(float)
        v /= (SV // 2 - 1); u /= (SU - 1)
        t = (v - 0.5) * 2
        at = np.abs(t)
        sh = (SV // 2, SU)
        n_big = fbm(sh, 4, sd, 3, tile=False)
        n_mid = fbm(sh, 5, sd + 1, 12, tile=False)
        n_fine = fbm(sh, 3, sd + 2, 96, tile=False)
        # nervura central (mais larga na base)
        mid_w = 0.032 * (1 - u) ** 1.2 + 0.005
        mid = np.exp(-(at / mid_w) ** 2)
        mid_edge = np.exp(-((at - mid_w * 1.1) / (mid_w * 0.45)) ** 2)
        # nervuras laterais finas e numerosas, quase perpendiculares, curvando para a margem
        wob = (n_mid - 0.5) * 0.012
        phase = (u - 0.18 * at - 0.10 * at ** 2 + wob) * 70
        lat = (0.5 + 0.5 * np.cos(phase * 2 * math.pi)) ** 26 * smoothstep(0.03, 0.08, at) * (1 - at ** 4)
        # nervura marginal coletora
        marg_v = np.exp(-((at - 0.955) / 0.012) ** 2)
        # reticulado fino entre nervuras
        ret = fbm(sh, 2, sd + 3, 160, tile=False)
        ret = np.clip((ret - 0.45) * 3, 0, 1)
        edge = smoothstep(0.965, 1.0, at)
        # --- face superior: verde escuro, brilhante
        base = np.array([52, 94, 34], float)
        tone = 0.86 + 0.16 * n_big + 0.08 * (n_mid - 0.5)
        col = base * tone[..., None]
        col *= (1 + 0.05 * lat[..., None] + 0.04 * marg_v[..., None])
        # leve amarelado próximo à nervura e na base
        col += np.array([18, 14, -4]) * (np.exp(-(at / 0.15) ** 2) * (1 - u) * 0.6)[..., None]
        midc = np.array([168, 170, 104], float)
        col = col * (1 - 0.92 * mid[..., None]) + midc * 0.92 * mid[..., None]
        col *= (1 - 0.15 * mid_edge[..., None])
        col = col * (1 - edge[..., None]) + np.array([120, 130, 60]) * edge[..., None]
        # pequenas manchas/poeira variando entre variantes
        spots = fbm(sh, 3, sd + 4, 40, tile=False)
        sp = smoothstep(0.70, 0.78, spots) * 0.12
        col = col * (1 - sp[..., None]) + np.array([95, 100, 60]) * sp[..., None]
        height = 1.0 * mid - 0.45 * mid_edge + 0.04 * lat + 0.06 * marg_v + 0.015 * n_fine + 0.06 * n_mid
        height = blur(height, 1.6)
        nm = normal_map(height, 6.0)
        rough = 0.30 + 0.10 * mid + 0.10 * n_mid + sp * 0.8
        # --- face inferior: verde claro, fosca, nervuras salientes
        bbase = np.array([96, 128, 66], float)
        bcol = bbase * (0.9 + 0.12 * n_big)[..., None]
        bcol *= (1 + 0.18 * lat[..., None])
        bmidc = np.array([170, 150, 100], float)   # nervura central levemente rosada/bege por baixo
        bcol = bcol * (1 - 0.95 * mid[..., None]) + bmidc * 0.95 * mid[..., None]
        bheight = 1.6 * mid + 0.25 * lat + 0.12 * marg_v + 0.02 * ret
        bnm = normal_map(blur(bheight, 1.0), 9.0)
        cols.append(col); nms.append(nm); mrs.append(mr_map(rough)); bcols.append(bcol); bnms.append(bnm)
    cat = lambda L: np.concatenate(L, 0)
    return jpg(cat(cols), 92), jpg(cat(nms), 94), jpg(cat(mrs), 90), jpg(cat(bcols), 90), jpg(cat(bnms), 92)

def bark_stem_texture(S=1024):
    sh = (S, S)
    n1 = fbm(sh, 5, 21, 4)
    streak = stretch(fbm((S, 48), 5, 22, 3), sh)          # estrias longitudinais (v ao longo do caule)
    fine = stretch(fbm((S, 160), 3, 24, 8), sh)
    dots_n = fbm(sh, 2, 23, 96)
    lent = smoothstep(0.76, 0.80, dots_n)                   # lenticelas
    lent_h = stretch(lent, (S // 3, S))                     # alongadas na horizontal
    lent_h = np.asarray(Image.fromarray((lent * 255).astype(np.uint8)).resize((S, S // 3)).resize((S, S)), float) / 255
    col = np.array([150, 124, 92], float) * ((0.78 + 0.35 * streak) * (0.9 + 0.18 * n1))[..., None]
    col *= (1 - 0.18 * fine[..., None])
    col = col * (1 - 0.35 * lent_h[..., None]) + np.array([190, 172, 140]) * 0.35 * lent_h[..., None]
    h = streak * 0.7 + fine * 0.5 + n1 * 0.3 + lent_h * 0.5
    rough = 0.62 + 0.15 * fine
    return jpg(col, 90), jpg(normal_map(h, 9), 92), jpg(mr_map(rough), 88)

def bark_chunk_texture(S=1024):
    sh = (S, S)
    n1 = fbm(sh, 6, 31, 5)
    fib = stretch(fbm((S, 64), 5, 32, 3), sh)
    fib2 = stretch(fbm((S, 200), 3, 36, 6), sh)
    warp = fbm(sh, 4, 34, 2)
    cr = np.abs(fbm(sh, 5, 35, 3) - 0.5 + 0.15 * (warp - 0.5))
    crack = np.clip(1 - cr / 0.03, 0, 1) ** 2
    flakes = fbm(sh, 5, 33, 8)
    plates = np.floor(flakes * 5) / 5                       # placas em camadas
    crack = crack * 0.35
    shade = (0.50 + 0.30 * fib + 0.22 * fib2 + 0.16 * plates) * (1 - 0.6 * crack)
    col = np.dstack([shade * 222, shade * 208, shade * 196]) * (0.86 + 0.24 * n1[..., None])
    # pontos de líquen/poeira acinzentados
    lich = smoothstep(0.74, 0.8, fbm(sh, 3, 37, 30))
    col = col * (1 - 0.35 * lich[..., None]) + 200 * 0.35 * lich[..., None]
    h = fib * 0.8 + fib2 * 0.7 + plates * 0.9 - crack * 0.6 + flakes * 0.3
    rough = 0.80 + 0.12 * crack
    return jpg(col, 88), jpg(normal_map(blur(h, 0.6), 16), 90), jpg(mr_map(rough), 85)

def stone_texture(S=512):
    sh = (S, S)
    n1 = fbm(sh, 6, 51, 4)
    grains = fbm(sh, 2, 52, 48)
    dark = smoothstep(0.62, 0.66, grains)
    light = 1 - smoothstep(0.30, 0.34, grains)
    g = (0.80 + 0.20 * n1) * (1 - 0.15 * dark) + 0.06 * light
    col = np.dstack([g * 205, g * 200, g * 192])
    h = n1 * 0.6 + grains * 0.3
    return jpg(col, 88), jpg(normal_map(blur(h, 1.5), 2), 90)

def soil_texture(S=512):
    sh = (S, S)
    n1 = fbm(sh, 6, 61, 6)
    grit = fbm(sh, 2, 62, 140)
    fib = stretch(fbm((S, 120), 3, 63, 20), sh)
    col = np.dstack([0.5 + 0.0 * n1] * 3) * 255
    col *= (0.7 + 0.5 * n1[..., None]) * (0.8 + 0.4 * grit[..., None])
    col += 40 * smoothstep(0.75, 0.8, fib)[..., None]
    h = n1 + grit * 0.6
    return jpg(col, 85), jpg(normal_map(h, 10), 88)

def pot_texture(S=1024):
    sh = (S, S)
    peel = fbm(sh, 3, 41, 64)            # casca de laranja da rotomoldagem
    broad = fbm(sh, 4, 42, 4)
    scratch = stretch(fbm((32, S), 3, 43, 2), sh)
    sc = smoothstep(0.80, 0.84, scratch) * smoothstep(0.4, 0.6, fbm(sh, 3, 44, 3))
    h = peel * 0.8 + broad * 0.2 - sc * 0.3
    rough = 0.50 + 0.10 * broad + 0.08 * peel - 0.10 * sc
    return jpg(normal_map(h, 2.0), 92), jpg(mr_map(rough), 88)

# ---------------------------------------------------------------- vaso
def lathe(profile, seg=160, v_scale=1.0, ao=None):
    prof = np.array(profile, float)
    m = len(prof)
    t = np.zeros_like(prof)
    t[1:-1] = prof[2:] - prof[:-2]
    t[0] = prof[1] - prof[0]
    t[-1] = prof[-1] - prof[-2]
    t = normalize(t)
    n2 = np.stack([t[:, 1], -t[:, 0]], 1)
    ang = np.linspace(0, 2 * math.pi, seg + 1)
    c, s = np.cos(ang), np.sin(ang)
    L = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(prof, axis=0), axis=1))])
    P = np.stack([prof[:, :1] * c, np.repeat(prof[:, 1:2], seg + 1, 1), prof[:, :1] * s], -1).reshape(-1, 3)
    N = np.stack([n2[:, :1] * c, np.repeat(n2[:, 1:2], seg + 1, 1), n2[:, :1] * s], -1).reshape(-1, 3)
    UV = np.stack([np.tile(ang / (2 * math.pi) * 6, (m, 1)), np.repeat(L[:, None] * v_scale, seg + 1, 1)], -1).reshape(-1, 2)
    C = None
    if ao is not None:
        C = np.repeat(np.array(ao, float)[:, None], seg + 1, 1).reshape(-1, 1) * np.ones((1, 3))
    return P, grid_faces(m, seg + 1), normalize(N), UV, C

def build_pot(pot):
    prof, ao = [], []
    def add(r, y, a=1.0):
        prof.append((r, y)); ao.append(a)
    # fundo com anel de apoio
    add(0.0, 0.004, 0.55); add(0.06, 0.004, 0.55); add(0.075, 0.002, 0.6); add(0.083, 0.0, 0.65)
    a_end = -math.atan((R_TOP - R_BOT) / POT_H)
    for k in range(9):
        a = -math.pi / 2 + k / 8 * (a_end + math.pi / 2)
        add(R_BOT - 0.008 + 0.008 * math.cos(a), 0.008 + 0.008 * math.sin(a), 0.7 + 0.03 * k)
    # parede externa
    band_y = POT_H - 0.032
    for y in np.linspace(0.02, band_y - 0.006, 34):
        add(r_out(y), y, min(1.0, 0.92 + y))
    # faixa de reforço da borda (lábio levemente saliente)
    for k in range(7):
        a = k / 6 * math.pi / 2
        add(r_out(band_y) + 0.0028 * (1 - math.cos(a)), band_y - 0.006 + 0.006 * math.sin(a))
    for y in np.linspace(band_y + 0.002, POT_H - 0.006, 6):
        add(r_out(y) + 0.0028, y)
    lip_r = (WALL + 0.0028) / 2
    cx = r_out(POT_H) + 0.0028 - lip_r
    cy = POT_H - lip_r
    for k in range(1, 17):
        a = k / 16 * math.pi
        add(cx + lip_r * math.cos(a), cy + lip_r * math.sin(a) * 0.9 + lip_r * 0.1 * math.sin(a))
    # parede interna, escurecendo para dentro (oclusão)
    for y in np.linspace(POT_H - lip_r - 0.002, MULCH_Y - 0.03, 12):
        depth = (POT_H - y) / (POT_H - MULCH_Y + 0.03)
        add(r_out(y) - WALL, y, 0.9 - 0.65 * depth ** 0.8)
    P, F, N, UV, C = lathe(prof, 180, 5, ao)
    pot.add(P, F, N=N, UV=UV, C=C)

# ---------------------------------------------------------------- primitivas
def icosphere(sub=2):
    t = (1 + 5 ** 0.5) / 2
    V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
         (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
         (8, 6, 7), (9, 8, 1)]
    V = [np.array(v, float) / np.linalg.norm(v) for v in V]
    for _ in range(sub):
        cache, F2 = {}, []
        def mid(a, b):
            k = (min(a, b), max(a, b))
            if k not in cache:
                m = V[a] + V[b]
                V.append(m / np.linalg.norm(m))
                cache[k] = len(V) - 1
            return cache[k]
        for a, b, c in F:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            F2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        F = F2
    return np.array(V), np.array(F)

ICO = {s: icosphere(s) for s in (1, 2, 3)}

def lump(sub, sx, sy, sz, rough, r, flat=0.0, cuts=0, grain=0.0):
    V, F = ICO[sub]
    V = V.copy()
    d = np.zeros(len(V))
    for _ in range(7):
        k = normalize(r.normal(size=3))
        f = r.uniform(1.5, 5.0)
        d += r.uniform(0.3, 1.0) * np.sin(V @ k * f + r.uniform(0, 6.28))
    V = V * (1 + rough * d / 3)[:, None]
    for _ in range(cuts):
        a = r.uniform(0, 6.28)
        k = normalize(np.array([math.cos(a), r.normal(0, 0.2), math.sin(a)]))
        dlim = r.uniform(0.5, 0.85)
        proj = V @ k
        over = proj > dlim
        V[over] -= np.outer(proj[over] - dlim, k)
    if flat:
        top = V[:, 1] > 0.35
        V[top, 1] = 0.35 + (V[top, 1] - 0.35) * (1 - flat)
        bot = V[:, 1] < -0.4
        V[bot, 1] = -0.4 + (V[bot, 1] + 0.4) * (1 - flat)
    if grain:
        # sulcos e camadas da casca na face superior
        ga = r.uniform(0, 6.28)
        gx = V[:, 0] * math.cos(ga) + V[:, 2] * math.sin(ga)
        gz = -V[:, 0] * math.sin(ga) + V[:, 2] * math.cos(ga)
        ridge = np.abs(np.sin(gz * r.uniform(5, 9) + 0.6 * np.sin(gx * 3 + r.uniform(0, 6))))
        layer = np.floor((gx * 0.5 + 0.5) * r.integers(2, 4) + 0.3 * np.sin(gz * 4)) * 0.06
        topw = smoothstep(0.0, 0.35, V[:, 1])
        V[:, 1] += topw * (grain * (ridge - 0.5) * 0.25 + layer)
    V *= np.array([sx, sy, sz])
    return V, F

# ---------------------------------------------------------------- cobertura: terra, raízes, casca, pedras
def build_soil(soil):
    nr, na = 14, 72
    rr = np.linspace(0, 1, nr) ** 0.8 * R_IN_MULCH
    aa = np.linspace(0, 2 * math.pi, na, endpoint=False)
    R_, A_ = np.meshgrid(rr, aa, indexing='ij')
    X, Z = R_ * np.cos(A_), R_ * np.sin(A_)
    noise = sum(rng.uniform(0.3, 1) * np.sin(X * rng.uniform(40, 120) + rng.uniform(0, 6)) *
                np.sin(Z * rng.uniform(40, 120) + rng.uniform(0, 6)) for _ in range(6))
    Y = MULCH_Y - 0.006 + 0.002 * noise / 3 + 0.004 * (1 - R_ / R_IN_MULCH)
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    F = grid_faces(nr, na, closed_v=True)
    UV = P[:, [0, 2]] * 8
    ao = 0.5 + 0.3 * (1 - R_ / R_IN_MULCH).reshape(-1)
    N = vertex_normals(P, F)
    if N[:, 1].sum() < 0:
        N = -N
    soil.add(P, F, N=N, UV=UV, C=np.outer(ao, [0.20, 0.14, 0.10]))

def build_roots(trunk_bases, roots):
    """Raízes superficiais saindo da base dos caules, mergulhando na cobertura."""
    for (bx, bz, br) in trunk_bases:
        n = int(rng.integers(3, 5))
        a0 = rng.uniform(0, 2 * math.pi)
        for k in range(n):
            a = a0 + k * 2 * math.pi / n + rng.normal(0, 0.35)
            length = rng.uniform(0.05, 0.12)
            d = np.array([math.cos(a), 0, math.sin(a)])
            side = np.array([-d[2], 0, d[0]])
            p0 = np.array([bx, MULCH_Y + 0.02, bz]) + d * br * 0.5
            s = np.linspace(0, 1, 24)[:, None]
            wig = np.sin(s * rng.uniform(4, 8) + rng.uniform(0, 6)) * rng.uniform(0.004, 0.01)
            hump = 0.010 * np.sin(s * math.pi * 0.8) - 0.03 * s ** 2.2
            path = p0 + d * length * s + side * wig + UP * (hump - 0.008 * s)
            rad = (br * 0.5) * (1 - 0.75 * s[:, 0] ** 0.8) + 0.0008
            P, F, N, UV, _ = tube(path, rad, 9, 12.0)
            sv = np.concatenate([np.repeat(s[:, 0], 10), [1.0]])[:, None]
            rc = np.array([0.50, 0.42, 0.36]) * (1 - 0.45 * sv) * rng.uniform(0.85, 1.05)
            roots.add(P, F, N=N, UV=UV, C=rc)
            # raízes finas secundárias
            if rng.uniform() < 0.7:
                j = int(rng.integers(8, 16))
                d2 = normalize(d + side * rng.choice([-1, 1]) * rng.uniform(0.6, 1.2))
                q0 = path[j]
                s2 = np.linspace(0, 1, 12)[:, None]
                path2 = q0 + d2 * rng.uniform(0.03, 0.06) * s2 + UP * (-0.012 * s2 ** 2)
                rad2 = rad[j] * 0.55 * (1 - 0.7 * s2[:, 0]) + 0.0005
                P, F, N, UV, _ = tube(path2, rad2, 7, 12.0)
                roots.add(P, F, N=N, UV=UV, C=np.array([0.36, 0.30, 0.26]))

def build_mulch(bark, stones, fines, avoid):
    placed = []
    def wall_ao(x, z):
        rr = math.hypot(x, z)
        return 0.72 + 0.28 * smoothstep(0, 0.035, R_IN_MULCH - rr)
    def near_trunk(x, z, rad):
        return any((x - ax) ** 2 + (z - az) ** 2 < (ar * 2.2 + rad * 0.6) ** 2 for ax, az, ar in avoid)
    n_big = 0
    layers = [(0.0, 1.0, 0.75), (0.006, 1.0, 0.88), (0.012, 0.75, 1.0)]
    tries = 0
    for lay_y, density, lay_ao in layers:
        target = int(120 * density)
        k = 0
        while k < target and tries < 40000:
            tries += 1
            rr = R_IN_MULCH * math.sqrt(rng.uniform(0, 1))
            a = rng.uniform(0, 2 * math.pi)
            x, z = rr * math.cos(a), rr * math.sin(a)
            is_stone = rng.uniform() < 0.05
            if is_stone:
                sx = rng.uniform(0.009, 0.016); sz = sx * rng.uniform(0.65, 0.9); sy = sx * rng.uniform(0.45, 0.6)
            else:
                big = rng.uniform() < 0.35
                sx = rng.uniform(0.020, 0.030) if big else rng.uniform(0.011, 0.020)
                sz = sx * rng.uniform(0.5, 0.85); sy = rng.uniform(0.004, 0.0085)
            ext = max(sx, sz)
            if rr + ext * 0.75 > R_IN_MULCH or near_trunk(x, z, ext):
                continue
            if any((x - px) ** 2 + (z - pz) ** 2 < ((ext + pr) * 0.6) ** 2 and abs(lay_y - py) < 0.005
                   for px, pz, pr, py in placed):
                continue
            placed.append((x, z, ext, lay_y))
            r = np.random.default_rng(int(rng.integers(1 << 30)))
            yaw = rng.uniform(0, 2 * math.pi)
            R = rot_axis(UP, yaw) @ rot_axis(np.array([1, 0, 0.]), rng.normal(0, 0.2)) @ rot_axis(np.array([0, 0, 1.]), rng.normal(0, 0.15))
            ao = lay_ao * wall_ao(x, z)
            if is_stone:
                V, F = lump(3, sx, sy, sz, 0.10, r)
                Vw = V @ R.T + np.array([x, MULCH_Y + lay_y + sy * 0.4, z])
                N = vertex_normals(Vw, F)
                g = rng.uniform(0.30, 0.48)
                c = np.array([g, g * 0.95, g * 0.88]) * ao
                stones.add(Vw, F, N=N, UV=V[:, [0, 2]] / 0.03 + rng.uniform(0, 1, 2), C=c)
            else:
                sub = 3 if (sx > 0.02 and lay_y > 0) else 2
                V, F = lump(sub, sx, sy, sz, 0.24, r, flat=0.88, cuts=int(rng.integers(3, 7)), grain=1.0)
                Vw = V @ R.T + np.array([x, MULCH_Y + lay_y + sy * 0.5, z])
                N = vertex_normals(Vw, F)
                pick = rng.uniform()
                if pick < 0.5:
                    c = np.array([0.34, 0.22, 0.16]) * rng.uniform(0.75, 1.1)
                elif pick < 0.8:
                    c = np.array([0.24, 0.17, 0.13]) * rng.uniform(0.8, 1.15)
                else:
                    c = np.array([0.40, 0.35, 0.31]) * rng.uniform(0.8, 1.05)
                up = N[:, 1:2]
                # lados/baixo mais escuros e avermelhados (casca interna), topo mais seco
                cv = c * (0.72 + 0.34 * (up * 0.5 + 0.5)) * (0.9 + 0.2 * r.random((len(V), 1)) ** 2)
                cv = cv * (1 - 0.15 * (up < 0.2)) + np.array([0.06, 0.02, 0.0]) * (up < 0.2)
                bark.add(Vw, F, N=N, UV=V[:, [0, 2]] / 0.06 + rng.uniform(0, 1, 2), C=np.clip(cv * ao, 0, 1))
                n_big += 1
            k += 1
    # lascas miúdas e fragmentos entre as peças maiores
    n_f = 0
    for _ in range(520):
        rr = R_IN_MULCH * math.sqrt(rng.uniform(0, 1)) * 0.97
        a = rng.uniform(0, 2 * math.pi)
        x, z = rr * math.cos(a), rr * math.sin(a)
        s = rng.uniform(0.0025, 0.008)
        if near_trunk(x, z, s):
            continue
        r = np.random.default_rng(int(rng.integers(1 << 30)))
        V, F = lump(1, s, s * rng.uniform(0.3, 0.6), s * rng.uniform(0.4, 0.9), 0.35, r, cuts=2)
        R = rot_axis(normalize(rng.normal(size=3)), rng.uniform(0, 6.28))
        Vw = V @ R.T + np.array([x, MULCH_Y + rng.uniform(0.0, 0.016), z])
        pick = rng.uniform()
        c = (np.array([0.32, 0.21, 0.15]) if pick < 0.6 else np.array([0.25, 0.18, 0.13]) if pick < 0.85
             else np.array([0.5, 0.48, 0.45])) * rng.uniform(0.7, 1.1) * wall_ao(x, z)
        fines.add(Vw, F, UV=V[:, [0, 2]] / 0.02 + rng.uniform(0, 1, 2), C=c)
        n_f += 1
    return n_big, n_f

# ---------------------------------------------------------------- caules e folhas
def bezier(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n)[:, None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3

def tube(path, radii, sides=12, v_scale=1.0, bumps=None, cap=True):
    path = np.asarray(path, float)
    m = len(path)
    T = np.zeros_like(path)
    T[1:-1] = path[2:] - path[:-2]
    T[0] = path[1] - path[0]
    T[-1] = path[-1] - path[-2]
    T = normalize(T)
    ref = np.array([1, 0, 0.]) if abs(T[0][0]) < 0.9 else np.array([0, 0, 1.])
    Nf = normalize(np.cross(T[0], ref))
    frames = []
    for i in range(m):
        if i > 0:
            Nf = Nf - T[i] * (Nf @ T[i])
            Nf = Nf / np.linalg.norm(Nf)
        frames.append((Nf.copy(), np.cross(T[i], Nf)))
    L = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
    ang = np.linspace(0, 2 * math.pi, sides + 1)
    A = np.array([f[0] for f in frames]); B = np.array([f[1] for f in frames])
    D = A[:, None, :] * np.cos(ang)[None, :, None] + B[:, None, :] * np.sin(ang)[None, :, None]
    r = np.asarray(radii, float)
    if bumps is not None:
        r = r * (1 + bumps)
    P = (path[:, None, :] + D * r[:, None, None]).reshape(-1, 3)
    N = D.reshape(-1, 3)
    UV = np.stack([np.tile(ang / (2 * math.pi), (m, 1)), np.repeat(L[:, None] * v_scale, sides + 1, 1)], -1).reshape(-1, 2)
    F = grid_faces(m, sides + 1)
    if cap:
        # ponta fechada (vértice central)
        tip = len(P)
        P = np.vstack([P, path[-1] + T[-1] * r[-1] * 0.5])
        N = np.vstack([N, T[-1]])
        UV = np.vstack([UV, [0.5, L[-1] * v_scale]])
        last = (m - 1) * (sides + 1)
        F = np.vstack([F, [[last + j, last + j + 1, tip] for j in range(sides)]])
    return P, F, N, UV, frames

def leaf_shape(L, W, fold, arch, droop, curl, twist, wave, asym, nu=38, nv=17):
    s = np.linspace(0, 1, nu) ** 1.05
    t = np.linspace(-1, 1, nv)
    S_, T_ = np.meshgrid(s, t, indexing='ij')
    x = (S_ - 0.46) / 0.54
    w = (np.clip(1 - np.abs(x) ** 2.3, 0, 1)) ** 0.62
    w *= np.clip(S_ / 0.06, 0, 1) ** 0.5 * 0.85 + 0.15
    w *= 1 - 0.38 * np.clip((S_ - 0.82) / 0.18, 0, 1) ** 1.4      # ponta acuminada
    w[-1, :] = 0
    hw = W / 2 * w * (1 + asym * np.sign(T_))                     # leve assimetria entre metades
    Z = T_ * hw
    X = S_ * L
    at = np.abs(T_)
    Y = fold * np.abs(Z) - curl * at ** 4 * hw * 0.25
    Y += arch * L * (S_ - S_ ** 2) * 1.2 - droop * L * S_ ** 2.2
    # ondulação suave da margem
    Y += wave * W * np.sin(S_ * math.pi * 3.5 + T_ * 0.8 + asym * 40) * at ** 3 * np.sin(S_ * math.pi)
    # nervura central levemente afundada
    Y -= 0.0012 * np.exp(-(Z / 0.004) ** 2) * (1 - S_)
    th = twist * S_
    Yr = Y * np.cos(th) + Z * np.sin(th)
    Zr = Z * np.cos(th) - Y * np.sin(th)
    P = np.stack([X, Yr, Zr], -1).reshape(-1, 3)
    UV = np.stack([S_, (T_ + 1) / 2], -1).reshape(-1, 2)
    return P, grid_faces(nu, nv), UV

def roll_leaf(P, radius, amount):
    """Enrola a folha em torno do eixo X (folha nova ainda abrindo)."""
    z, y = P[:, 2], P[:, 1]
    th = z / radius * amount
    P = P.copy()
    P[:, 2] = radius / amount * np.sin(th)
    P[:, 1] = y + radius / amount * (1 - np.cos(th))
    return P

def place_leaf(Pl, ldir, roll, origin):
    side = np.cross(UP, ldir)
    if np.linalg.norm(side) < 1e-6:
        side = np.array([1, 0, 0.])
    side = normalize(side)
    upv = np.cross(ldir, side)
    Rr = rot_axis(ldir, roll)
    M = np.stack([ldir, Rr @ upv, Rr @ side], 1)
    return Pl @ M.T + origin, Rr @ upv

class Plant:
    def __init__(self):
        self.leaves_top = Mesh(); self.leaves_bot = Mesh()
        self.stem = Mesh(); self.petiole = Mesh(); self.bud = Mesh()
        self.n_leaves = 0

    def add_leaf(self, origin, ldir, roll, L, W, youth, rolled=0.0):
        fold = 0.10 + 0.22 * youth + rng.uniform(-0.03, 0.05)
        arch = rng.uniform(0.04, 0.10)
        droop = (0.26 - 0.22 * youth) * rng.uniform(0.7, 1.2)
        Pl, Fl, UVl = leaf_shape(L, W, fold, arch, droop, rng.uniform(0.2, 0.6), rng.normal(0, 0.12),
                                 rng.uniform(0.004, 0.012), rng.normal(0, 0.04))
        if rolled:
            Pl = roll_leaf(Pl, W * 0.16, rolled)
        var = int(rng.integers(LEAF_VARIANTS))
        UVl = UVl.copy()
        UVl[:, 1] = (UVl[:, 1] + var) / LEAF_VARIANTS
        Pw, upv = place_leaf(Pl, ldir, roll, origin)
        N = vertex_normals(Pw, Fl)
        if (N.mean(0) @ upv) < 0 and not rolled:
            N = -N
        g = rng.uniform(0.9, 1.05)
        old = np.array([0.52, 0.58, 0.48]) * g
        young = np.array([0.95, 1.0, 0.72])
        yy = youth ** 2.2
        c = old * (1 - yy) + young * yy
        # folhas novas com tom bronze/avermelhado na ponta
        if rolled:
            c = np.array([0.85, 0.75, 0.55])
        self.leaves_top.add(Pw, Fl, N=N, UV=UVl, C=np.clip(c, 0, 1))
        cb = np.clip(c * np.array([1.0, 1.0, 1.0]) * 0.95 + 0.05, 0, 1)
        self.leaves_bot.add(Pw - N * 0.0006, Fl, N=-N, UV=UVl, C=cb)
        self.n_leaves += 1

    def grow(self, path, r0, r1, nleaf, start, v_scale=9.0, base_flare=False, tip_bud=True, phase0=None,
             leaf_scale=1.0, aerial=0):
        m = len(path)
        u = np.linspace(0, 1, m)
        radii = r0 + (r1 - r0) * u ** 0.9
        if base_flare:
            yb = path[0, 1]
            radii = radii * (1 + 0.9 * np.exp(-np.maximum(path[:, 1] - (MULCH_Y - 0.01), 0) / 0.018))
        node_u = start + (1 - start - 0.035) * (np.linspace(0, 1, nleaf) ** 0.85)
        scar_u = np.linspace(0.12, start - 0.03, 5) + rng.uniform(-0.015, 0.015, 5) if start > 0.2 else np.array([])
        if phase0 is None:
            phase0 = rng.uniform(0, 2 * math.pi)
        golden = math.radians(137.5)
        all_u = np.concatenate([node_u, scar_u])
        all_az = phase0 + np.concatenate([np.arange(nleaf), -1 - np.arange(len(scar_u))]) * golden
        bumps = np.zeros(m)
        for nu_ in node_u:
            bumps += 0.05 * np.exp(-((u - nu_) / 0.006) ** 2)
        P, F, N, UV, frames = tube(path, radii, 16, v_scale, bumps)
        S1 = 17
        uu = np.concatenate([np.repeat(u, S1), [1.0]])
        rr = np.concatenate([np.repeat(radii, S1), [radii[-1]]])
        col = (np.array([0.80, 0.76, 0.70])[None] * (1 - uu[:, None] ** 2) +
               np.array([0.62, 0.78, 0.48])[None] * uu[:, None] ** 2)
        # cicatrizes foliares em meia-lua do lado de cada folha (atual ou já caída)
        for nu_, az in zip(all_u, all_az):
            out = np.array([math.cos(az), 0, math.sin(az)])
            face = np.clip(N @ out, 0, 1) ** 2
            band = np.exp(-((uu - nu_) / 0.0045) ** 2)
            lip = np.exp(-((uu - nu_ + 0.004) / 0.0025) ** 2)
            P += N * (rr * (0.22 * band * face + 0.10 * lip * face))[:, None]
            col *= (1 - 0.30 * (lip * face) + 0.10 * (band * face) * 0)[:, None]
            # anel fino da estípula, ao redor do caule todo
            ring = np.exp(-((uu - nu_ - 0.002) / 0.0012) ** 2)
            col *= (1 - 0.22 * ring)[:, None]
        N0 = N
        N = vertex_normals(P, F)
        if (N * N0).sum() < 0:
            N = -N
        self.stem.add(P, F, N=N, UV=UV, C=col)
        if tip_bud:
            tip = path[-1]
            tdir = normalize(path[-1] - path[-3])
            bl = rng.uniform(0.035, 0.055)
            bpath = np.array([tip + tdir * bl * k + np.array([0.0, 0, 0]) for k in np.linspace(0, 1, 14)])
            bpath += np.outer(np.linspace(0, 1, 14) ** 2, normalize(rng.normal(size=3)) * 0.004)
            brad = radii[-1] * 0.95 * (1 - np.linspace(0, 1, 14) ** 1.6) + 0.0003
            Pb, Fb, Nb, _, _ = tube(bpath, brad, 12, 1.0)
            tcol = np.linspace(0, 1, 14).repeat(13)
            tcol = np.concatenate([tcol, [1.0]])[:, None]
            cb = np.array([0.55, 0.42, 0.30]) * (1 - tcol) + np.array([0.66, 0.32, 0.28]) * tcol
            self.bud.add(Pb, Fb, N=Nb, C=cb)
        for li, nu_ in enumerate(node_u):
            idx = min(max(int(nu_ * (m - 1)), 1), m - 2)
            node = path[idx]
            T = normalize(path[idx + 1] - path[idx - 1])
            az = phase0 + li * golden
            out = np.array([math.cos(az), 0, math.sin(az)])
            out = normalize(out - T * (out @ T))
            youth = li / max(nleaf - 1, 1)
            node_r = radii[idx]
            pet_len = (0.05 - 0.022 * youth + rng.uniform(-0.006, 0.006)) * leaf_scale
            pet_elev = math.radians(35 + 30 * youth)
            pdir = normalize(out * math.cos(pet_elev) + UP * math.sin(pet_elev))
            start_p = node + out * node_r * 0.7
            pend = start_p + pdir * pet_len + UP * (-0.005 * (1 - youth))
            ppath = bezier(start_p, start_p + pdir * pet_len * 0.35, start_p + pdir * pet_len * 0.7 + UP * 0.004, pend, 12)
            sp = np.linspace(0, 1, 12)
            # pulvino: engrossa nas duas extremidades
            prad = (0.0026 + 0.0012 * np.exp(-sp / 0.12) + 0.0008 * np.exp(-(1 - sp) / 0.1)) * (1 - 0.3 * youth) * leaf_scale ** 0.5
            Pp, Fp, Np, _, _ = tube(ppath, prad, 10, 1.0)
            pc = np.array([0.36, 0.40, 0.16]) * (1 - youth) + np.array([0.46, 0.30, 0.18]) * youth
            spc = np.concatenate([sp.repeat(11), [1.0]])[:, None]
            pcv = pc * (0.85 + 0.15 * spc)
            self.petiole.add(Pp, Fp, N=Np, C=pcv)
            Lr = (0.27 - 0.11 * youth ** 1.3) * rng.uniform(0.9, 1.08) * leaf_scale
            rolled = 0.0
            if li == nleaf - 1:
                Lr *= 0.62
                rolled = rng.uniform(0.6, 0.95) if rng.uniform() < 0.6 else 0.0
            Wr = Lr * rng.uniform(0.46, 0.54)
            elev = math.radians(18 + 50 * youth ** 1.1 + rng.uniform(-10, 10) + (25 if rolled else 0))
            ldir = normalize(out * math.cos(elev) + UP * math.sin(elev))
            self.add_leaf(pend, ldir, rng.normal(0, 0.35), Lr, Wr, youth, rolled)
        # raízes aéreas finas pendendo de nós baixos
        for _ in range(aerial):
            j = int(rng.uniform(0.18, 0.4) * (m - 1))
            p0 = path[j]
            a = rng.uniform(0, 2 * math.pi)
            d = np.array([math.cos(a), 0, math.sin(a)])
            drop = p0[1] - (MULCH_Y + 0.005)
            s = np.linspace(0, 1, 30)[:, None]
            ap = p0 + d * (radii[j] + 0.01 * np.sin(s * math.pi) + 0.006 * s) - UP * drop * s ** 1.15
            ap += np.outer(np.sin(s[:, 0] * 9 + a), np.array([-d[2], 0, d[0]])) * 0.002
            ar = 0.0016 * (1 - 0.4 * s[:, 0]) + 0.0003
            Pa, Fa, Na, UVa, _ = tube(ap, ar, 8, 20.0)
            self.stem.add(Pa, Fa, N=Na, UV=UVa, C=np.array([0.72, 0.62, 0.52]))
        return radii

def build_plant(plant):
    base = np.array([0, MULCH_Y, 0.])
    trunks = [
        dict(b=(-0.013, 0.000), top=(-0.15, 1.10, 0.03), c1=(-0.02, 0.25, 0.0), r=0.0108, nleaves=15, branch=0.52, aerial=1),
        dict(b=(0.015, 0.008), top=(0.16, 1.04, -0.06), c1=(0.03, 0.22, 0.0), r=0.0100, nleaves=13, branch=0.58, aerial=1),
        dict(b=(0.002, -0.016), top=(0.03, 1.16, -0.13), c1=(0.00, 0.25, -0.02), r=0.0094, nleaves=13, branch=None, aerial=0),
        dict(b=(-0.004, 0.017), top=(0.00, 0.96, 0.16), c1=(0.0, 0.2, 0.03), r=0.0088, nleaves=11, branch=None, aerial=0),
    ]
    bases = []
    for ti, tr in enumerate(trunks):
        p0 = base + np.array([tr['b'][0], -0.025, tr['b'][1]])
        p3 = np.array(tr['top'], float)
        p1 = p0 + np.array(tr['c1'])
        p2 = p3.copy(); p2[1] -= 0.25
        n = 120
        path = bezier(p0, p1, p2, p3, n)
        path[:, 0] += 0.006 * np.sin(np.linspace(0, 7, n) + ti)
        path[:, 2] += 0.006 * np.cos(np.linspace(0, 6, n) + 2 * ti)
        start = 0.26 + rng.uniform(-0.04, 0.05)
        radii = plant.grow(path, tr['r'], tr['r'] * 0.36, tr['nleaves'], start, base_flare=True, aerial=tr['aerial'])
        bases.append((path[0, 0], path[0, 2], tr['r'] * 1.6))
        if tr['branch']:
            j = int(tr['branch'] * (n - 1))
            q0 = path[j]
            T = normalize(path[j + 1] - path[j - 1])
            a = rng.uniform(0, 2 * math.pi)
            out = normalize(np.array([math.cos(a), 0, math.sin(a)]) - T * 0)
            if out @ np.array([q0[0], 0, q0[2]]) < 0:
                out = -out
            d = normalize(out * 0.9 + UP * 0.9)
            q3 = q0 + d * 0.16 + UP * 0.1
            bpath = bezier(q0 - T * 0.004, q0 + d * 0.05, q3 - UP * 0.05, q3, 50)
            plant.grow(bpath, radii[j] * 0.75, radii[j] * 0.3, int(rng.integers(5, 7)), 0.3, v_scale=9.0, leaf_scale=0.85)
    return bases

# ---------------------------------------------------------------- glb
class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.j = dict(asset=dict(version='2.0', generator='lp-imoveis ficus gen v2'), scene=0,
                      scenes=[dict(nodes=[0])], nodes=[dict(name='VasoFicus', children=[])], meshes=[],
                      materials=[], accessors=[], bufferViews=[], buffers=[], images=[], textures=[],
                      samplers=[dict(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497)])
    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        v = dict(buffer=0, byteOffset=off, byteLength=len(data))
        if target:
            v['target'] = target
        self.j['bufferViews'].append(v)
        return len(self.j['bufferViews']) - 1
    def _acc(self, arr, ctype, typ, target, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr)
        bv = self._view(arr.tobytes(), target)
        a = dict(bufferView=bv, componentType=ctype, count=len(arr), type=typ)
        if normalized:
            a['normalized'] = True
        if minmax:
            a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        self.j['accessors'].append(a)
        return len(self.j['accessors']) - 1
    def image(self, data_mime):
        data, mime = data_mime
        bv = self._view(data)
        self.j['images'].append(dict(bufferView=bv, mimeType=mime))
        self.j['textures'].append(dict(sampler=0, source=len(self.j['images']) - 1))
        return len(self.j['textures']) - 1
    def material(self, m):
        self.j['materials'].append(m)
        return len(self.j['materials']) - 1
    def mesh(self, name, mesh, mat, colors=True):
        P, N, UV, C, F = mesh.arrays()
        attrs = dict(POSITION=self._acc(P.astype(np.float32), 5126, 'VEC3', 34962, True),
                     NORMAL=self._acc(normalize(N).astype(np.float32), 5126, 'VEC3', 34962),
                     TEXCOORD_0=self._acc(UV.astype(np.float32), 5126, 'VEC2', 34962))
        if colors:
            c8 = np.round(np.clip(np.hstack([C, np.ones((len(C), 1))]), 0, 1) * 255).astype(np.uint8)
            attrs['COLOR_0'] = self._acc(c8, 5121, 'VEC4', 34962, normalized=True)
        big = len(P) > 65535
        idx = self._acc(F.reshape(-1).astype(np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963)
        self.j['meshes'].append(dict(name=name, primitives=[dict(attributes=attrs, indices=idx, material=mat)]))
        self.j['nodes'].append(dict(name=name, mesh=len(self.j['meshes']) - 1))
        self.j['nodes'][0]['children'].append(len(self.j['nodes']) - 1)
        return len(P), len(F)
    def save(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.j['buffers'] = [dict(byteLength=len(self.bin))]
        js = json.dumps(self.j, separators=(',', ':')).encode()
        js += b' ' * ((4 - len(js) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942)); f.write(self.bin)

def srgb_to_lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def main():
    pot = Mesh(); soil = Mesh(); roots = Mesh(); bark = Mesh(); stones = Mesh(); fines = Mesh()
    plant = Plant()
    build_pot(pot)
    build_soil(soil)
    bases = build_plant(plant)
    build_roots(bases, roots)
    nb, nf = build_mulch(bark, stones, fines, bases)

    # escala só a parte aérea para a altura total ficar exata
    aerial = [plant.leaves_top, plant.leaves_bot, plant.stem, plant.petiole, plant.bud]
    ymax = max(np.vstack(m.P)[:, 1].max() for m in aerial)
    k = (TOTAL_H - MULCH_Y) / (ymax - MULCH_Y)
    for m in aerial:
        m.P = [(p - [0, MULCH_Y, 0]) * k + [0, MULCH_Y, 0] for p in m.P]
    # cores de vértice em espaço linear (o AO do vaso já é um fator linear)
    for m in [soil, roots, bark, stones, fines] + aerial:
        m.C = [srgb_to_lin(c) for c in m.C]

    g = GLB()
    lc, ln, lmr, lbc, lbn = leaf_textures()
    sc, sn, smr = bark_stem_texture()
    bc, bn, bmr = bark_chunk_texture()
    stc, stn = stone_texture()
    soc, son = soil_texture()
    pn, pmr = pot_texture()
    t = {k_: g.image(v) for k_, v in dict(lc=lc, ln=ln, lmr=lmr, lbc=lbc, lbn=lbn, sc=sc, sn=sn, smr=smr,
                                            bc=bc, bn=bn, bmr=bmr, stc=stc, stn=stn, soc=soc, son=son,
                                            pn=pn, pmr=pmr).items()}
    def pbr(name, color=None, tex=None, nrm=None, nscale=1.0, mr=None, rough=1.0, **extra):
        p = dict(metallicFactor=0.0, roughnessFactor=rough)
        if color: p['baseColorFactor'] = color
        if tex is not None: p['baseColorTexture'] = dict(index=t[tex])
        if mr is not None: p['metallicRoughnessTexture'] = dict(index=t[mr])
        m = dict(name=name, pbrMetallicRoughness=p, **extra)
        if nrm is not None: m['normalTexture'] = dict(index=t[nrm], scale=nscale)
        return g.material(m)
    m_pot = pbr('Vaso_Preto_Fosco', color=[0.018, 0.018, 0.02, 1], nrm='pn', nscale=0.35, mr='pmr')
    m_leaf = pbr('Folha_Ficus', tex='lc', nrm='ln', mr='lmr',
                 extensions=dict(KHR_materials_clearcoat=dict(clearcoatFactor=0.2, clearcoatRoughnessFactor=0.22)))
    m_leafb = pbr('Folha_Ficus_Verso', tex='lbc', nrm='lbn', rough=0.62)
    m_stem = pbr('Caule', tex='sc', nrm='sn', mr='smr')
    m_pet = pbr('Peciolo', rough=0.42)
    m_bud = pbr('Broto', rough=0.3)
    m_root = pbr('Raiz', tex='sc', nrm='sn', rough=0.8)
    m_bark = pbr('Casca_Pinus', tex='bc', nrm='bn', mr='bmr')
    m_fine = pbr('Casca_Pinus_Fina', tex='bc', nrm='bn', rough=0.85)
    m_stone = pbr('Pedrisco', tex='stc', nrm='stn', nscale=0.6, rough=0.7)
    m_soil = pbr('Terra', tex='soc', nrm='son', rough=0.95)
    g.j['extensionsUsed'] = ['KHR_materials_clearcoat']
    stats = {}
    stats['vaso'] = g.mesh('Vaso', pot, m_pot)
    stats['terra'] = g.mesh('Terra', soil, m_soil)
    stats['raizes'] = g.mesh('Raizes', roots, m_root)
    stats['casca'] = g.mesh('CascaPinus', bark, m_bark)
    stats['lascas'] = g.mesh('CascaPinusFina', fines, m_fine)
    stats['pedras'] = g.mesh('Pedriscos', stones, m_stone)
    stats['caules'] = g.mesh('Caules', plant.stem, m_stem)
    stats['peciolos'] = g.mesh('Peciolos', plant.petiole, m_pet)
    stats['brotos'] = g.mesh('Brotos', plant.bud, m_bud)
    stats['folhas'] = g.mesh('Folhas', plant.leaves_top, m_leaf)
    stats['folhas_verso'] = g.mesh('FolhasVerso', plant.leaves_bot, m_leafb)
    g.save(OUT)
    allP = np.vstack([np.vstack(m.P) for m in [pot, soil, roots, bark, stones, fines] + aerial])
    print('casca', nb, 'lascas', nf, 'folhas', plant.n_leaves, 'escala', round(k, 3))
    print('bbox min', allP.min(0).round(3), 'max', allP.max(0).round(3))
    print(stats, 'tris', sum(v[1] for v in stats.values()))

if __name__ == '__main__':
    main()
