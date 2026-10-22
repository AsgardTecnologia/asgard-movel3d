"""Gera sofa-couro.glb: sofá 2 lugares em couro preto, braços retos, almofadas soltas e pés de madeira.
186 L x 90 P x 80 A cm (assento a 44 cm, braço a 60 cm). Metros, Y para cima, frente em +Z, chão em y=0."""
import sys, math, time
import numpy as np
from ficus2 import (normalize, vertex_normals, grid_faces, rot_axis, smoothstep, Mesh, fbm, blur,
                    jpg, normal_map, tube, GLB, srgb_to_lin)
from ao import bake_ao

OUT = sys.argv[1]
rng = np.random.default_rng(23)
COR_COURO = '#232528'           # preto grafite, como o couro das fotos
UVS = 2.5                      # textura do couro (a mesma da poltrona) repete a cada 40 cm

def hex_lin(h):
    return srgb_to_lin([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])

PARTS = []   # (nome, material, [(P, F, N, UV)])

def place(P, N, R, t):
    return P @ R.T + t, N @ R.T

def waves(r, X, Y, n, f0, f1):
    out = np.zeros_like(X)
    for _ in range(n):
        a = r.uniform(0, math.pi)
        out += r.uniform(0.4, 1) * np.sin((X * math.cos(a) + Y * math.sin(a)) * r.uniform(f0, f1) + r.uniform(0, 6.28))
    return out / n

def seam_profile(d, g=0.0022, w=0.0026, welt=False):
    """Costura: vinco central com as duas bordas do couro levemente estufadas.
    welt: costura de quina com vivo (cordão saltado entre dois vincos), como no topo dos braços."""
    if welt:
        return 0.0022 * np.exp(-(d / 0.0024) ** 2) - 0.0012 * np.exp(-((d - 0.0045) / 0.0015) ** 2)
    return -g * np.exp(-(d / w) ** 2) + 0.35 * g * np.exp(-((d - 2.2 * w) / (1.1 * w)) ** 2)

# ---------------------------------------------------------------- caixas revestidas (braços, encosto, base)
def axis_coords(h, r, seams, base=0.016):
    """Coordenadas de uma aresta da grade: mais densas nas quinas arredondadas e junto às costuras."""
    c = [np.linspace(-h, h, max(4, int(2 * h / base)) + 1)]
    for s in (-1, 1):
        c.append(s * (h - r + r * np.sin(np.linspace(0, 1, 7) * math.pi / 2)))
        c.append(s * (h - r - np.linspace(0, 0.02, 3)))
    for v in seams:
        if abs(v) < h:
            c.append(np.clip(v + np.linspace(-0.012, 0.012, 15), -h, h))
    c = np.unique(np.round(np.concatenate(c), 5))
    keep = np.concatenate([[True], np.diff(c) > 6e-4])
    return c[keep]

def rbox(hx, hy, hz, r, bulge=0.0, wrinkle=0.0006, seams=(), seed=0):
    """Caixa de quinas arredondadas com costuras. seams: (eixo, valor, máscara(n) ou None)."""
    rr = np.random.default_rng(seed)
    h = np.array([hx, hy, hz])
    sv = [[s[1] for s in seams if s[0] == k] for k in range(3)]
    seams = [tuple(s) + (False,) * (4 - len(s)) for s in seams]
    out = []
    for ax in range(3):
        for sgn in (-1, 1):
            a1, a2 = [k for k in range(3) if k != ax]
            c1, c2 = axis_coords(h[a1], r, sv[a1]), axis_coords(h[a2], r, sv[a2])
            T1, T2 = np.meshgrid(c1, c2, indexing='ij')
            n1, n2 = len(c1), len(c2)
            p = np.zeros((n1, n2, 3))
            p[..., ax] = sgn * h[ax]
            p[..., a1] = T1
            p[..., a2] = T2
            p = p.reshape(-1, 3)
            q = np.clip(p, -(h - r), h - r)
            n = normalize(p - q)
            P = q + r * n
            u1, u2 = (T1 / h[a1]).reshape(-1), (T2 / h[a2]).reshape(-1)
            f = np.clip(1 - u1 ** 2, 0, 1) * np.clip(1 - u2 ** 2, 0, 1)
            disp = sgn * (bulge * f ** 0.6 + wrinkle * waves(rr, p[:, a1], p[:, a2], 6, 10, 40) * f ** 0.5)
            P[:, ax] += disp
            for (k, v, mask, welt) in seams:
                m = np.ones(len(P), bool) if mask is None else mask(n, p)
                P[m] += n[m] * seam_profile(np.abs(P[m, k] - v), welt=welt)[:, None]
            F = grid_faces(n1, n2)
            if (vertex_normals(P, F) * n).sum() < 0:
                F = F[:, [0, 2, 1]]
            UV = np.stack([P[:, a1], P[:, a2]], 1) * UVS
            out.append((P, F, None, UV))
    return welded_normals(out)

def welded_normals(geo):
    """Normais calculadas com as faces soldadas: sem quina iluminada onde duas faces se encontram."""
    Ps = np.vstack([g[0] for g in geo])
    Fs, b = [], 0
    for g in geo:
        Fs.append(g[1] + b); b += len(g[0])
    _, inv = np.unique(np.round(Ps / 2e-5).astype(np.int64), axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    Pw = np.zeros((inv.max() + 1, 3)); Pw[inv] = Ps
    Nw = vertex_normals(Pw, inv[np.vstack(Fs)])
    out, b = [], 0
    for (P, F, _, UV) in geo:
        out.append((P, F, Nw[inv[b:b + len(P)]], UV)); b += len(P)
    return out

# ---------------------------------------------------------------- almofadas de couro
def crease_field(X, Y, creases):
    dz = np.zeros_like(X)
    for (cx, cy, ang, L, w, a, bend) in creases:
        ca, sa = math.cos(ang), math.sin(ang)
        s = (X - cx) * ca + (Y - cy) * sa
        t = -(X - cx) * sa + (Y - cy) * ca - bend * s * s
        env = 1 - smoothstep(0.35 * L, L, np.abs(s))
        env *= 0.6 + 0.4 * np.cos(s / L * 2.1)                 # profundidade varia ao longo da ruga
        prof = -a * np.exp(-(t / w) ** 2) + 0.4 * a * np.exp(-((np.abs(t) - 1.9 * w) / (1.2 * w)) ** 2)
        dz += prof * env
    return dz

def grid_1d(n):
    t = np.linspace(-1, 1, n)
    return 0.5 + 0.5 * (0.55 * t + 0.45 * np.sin(t * math.pi / 2))

def cushion(W, H, T, creases=(), back_creases=(), res=0.0062, deform=None, puff=0.2, e_frac=0.3, bulge=0.012,
            top_frac=0.55, lumps=0.004, seed=0, welt=0.0026):
    """Almofada de couro (local: x largura, y altura, z espessura, face principal em +z).
    Couro mais firme que tecido: laterais quase retas, coroa suave e rugas de uso."""
    r = np.random.default_rng(seed)
    lump_w = [(r.uniform(0, math.pi), r.uniform(5, 12), r.uniform(0, 6.28), r.uniform(0.4, 1)) for _ in range(5)]

    def lumpf(X, Y):
        out = sum(a_ * np.sin((X * math.cos(an) + Y * math.sin(an)) * f + ph) for an, f, ph, a_ in lump_w) / len(lump_w)
        pf = np.clip(1 - (2 * X / W) ** 2, 0, 1) * np.clip(1 - (2 * Y / H) ** 2, 0, 1)
        return lumps * out * pf ** 0.4

    def outline(X, Y):
        ex = np.clip(1 - (2 * Y / H) ** 2, 0, 1) * (2 * np.abs(X) / W) ** 4
        ey = np.clip(1 - (2 * X / W) ** 2, 0, 1) * (2 * np.abs(Y) / H) ** 4
        return X + np.sign(X) * ex * bulge, Y + np.sign(Y) * ey * bulge

    def surface(nx, ny, front):
        U, V = np.meshgrid(grid_1d(nx), grid_1d(ny), indexing='ij')
        X = (U - 0.5) * W; Y = (V - 0.5) * H
        k = 0.012
        dx, dy = W / 2 - np.abs(X), H / 2 - np.abs(Y)
        d = np.maximum(-k * np.log(np.exp(-dx / k) + np.exp(-dy / k)), 0)
        e = T * e_frac
        g = np.sqrt(np.clip(1 - (1 - np.clip(d / e, 0, 1)) ** 2, 0, 1)) ** 0.8
        pf = np.clip(1 - (2 * X / W) ** 2, 0, 1) * np.clip(1 - (2 * Y / H) ** 2, 0, 1)
        half = T * (top_frac if front else 1 - top_frac)
        z = half * g * (1 - puff + puff * pf ** 0.5)
        inner = np.clip(d / (e * 0.5), 0, 1)
        if front:
            dz = crease_field(X, Y, creases)
            dz += 0.0012 * waves(r, X, Y, 6, 8, 22) * pf
            dz += 0.0004 * waves(r, X, Y, 8, 60, 160) * pf ** 0.5
            # no topo da borda o couro repuxa na costura: pequenas pregas
            along = np.where(dx < dy, Y, X)
            dz -= 0.0012 * np.exp(-d / 0.012) * (0.5 + 0.5 * np.sin(along * 2 * math.pi / r.uniform(0.05, 0.08)
                                                                    + waves(r, X, Y, 3, 4, 10) * 2)) ** 2 * (d > 0.002)
        else:
            dz = crease_field(X, Y, back_creases) + 0.0015 * waves(r, X, Y, 4, 8, 20) * pf
        # rugas também descem pela lateral até a costura (atenuadas)
        dz = dz * (0.35 + 0.65 * inner)
        Xp, Yp = outline(X, Y)
        Z = (z + dz if front else -(z + dz)) + lumpf(X, Y)
        return Xp, Yp, Z, X, Y

    geo = []
    nxf = int(np.clip(W / res, 40, 170)); nyf = int(np.clip(H / res, 40, 170))
    for front, (nx, ny) in ((True, (nxf, nyf)), (False, (max(24, nxf // 2), max(24, nyf // 2)))):
        Xp, Yp, Z, X, Y = surface(nx, ny, front)
        if deform is not None:
            Xp, Yp, Z = deform(Xp, Yp, Z)
        P = np.stack([Xp, Yp, Z], -1).reshape(-1, 3)
        F = grid_faces(nx, ny)
        N = vertex_normals(P, F)
        if N[:, 2].sum() * (1 if front else -1) < 0:
            N = -N
        UV = np.stack([X.reshape(-1), Y.reshape(-1)], 1) * UVS
        geo.append((P, F, N, UV))
    # vivo fino de couro na costura do contorno
    per = []
    for (x0, y0, x1, y1) in [(-W / 2, -H / 2, W / 2, -H / 2), (W / 2, -H / 2, W / 2, H / 2),
                             (W / 2, H / 2, -W / 2, H / 2), (-W / 2, H / 2, -W / 2, -H / 2)]:
        n = max(30, int(math.hypot(x1 - x0, y1 - y0) / 0.004))
        t = np.linspace(0, 1, n, endpoint=False)
        per.append(np.stack([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t], 1))
    per = np.vstack(per)
    per = np.vstack([per, per[:1]])
    # cantos arredondados no caminho do vivo
    k = 0.012
    px, py = per[:, 0], per[:, 1]
    cxp = np.clip(px, -W / 2 + k * 2, W / 2 - k * 2); cyp = np.clip(py, -H / 2 + k * 2, H / 2 - k * 2)
    dv = normalize(np.stack([px - cxp, py - cyp], 1))
    corner = (np.abs(px) > W / 2 - k * 2) & (np.abs(py) > H / 2 - k * 2)
    px = np.where(corner, cxp + dv[:, 0] * k * 2, px); py = np.where(corner, cyp + dv[:, 1] * k * 2, py)
    px, py = outline(px, py)
    pz = (2 * top_frac - 1) * 0 + lumpf(per[:, 0], per[:, 1])
    path = np.stack([px, py, pz], 1)
    Pp, Fp, Np, UVp, _ = tube(path, np.full(len(path), welt), 8, 40.0, cap=False)
    ctr = np.repeat(path, 9, 0)
    off = Pp - ctr
    off[:, 2] *= 0.8
    Pp = ctr + off
    if deform is not None:
        a, b, c = deform(Pp[:, 0], Pp[:, 1], Pp[:, 2])
        Pp = np.stack([a, b, c], 1)
    Np2 = vertex_normals(Pp, Fp)
    if (Np2 * Np).sum() < 0:
        Np2 = -Np2
    geo.append((Pp, Fp, Np2, UVp * 0.1))
    return geo

def leg(top=0.026, bot=0.017, H=0.10, r=0.005):
    """Pé de madeira quadrado e cônico."""
    geo = rbox(top, H / 2, top, r, wrinkle=0)
    out = []
    for (P, F, N, UV) in geo:
        s = (bot + (top - bot) * (P[:, 1] + H / 2) / H) / top
        P = P.copy(); P[:, 0] *= s; P[:, 2] *= s
        N = vertex_normals(P, F)
        out.append((P, F, N, np.stack([P[:, 0] + P[:, 2], P[:, 1] * 0.6], 1) * 2))
    return out

def box_uv(P, N):
    """Projeção pelo eixo dominante da normal: o grão do couro não estica nas laterais curvas."""
    ax = np.abs(N).argmax(1)
    return np.where((ax == 1)[:, None], P[:, [0, 2]], np.where((ax == 2)[:, None], P[:, [0, 1]], P[:, [2, 1]])) * UVS

def add_part(name, mat, geo, R, t):
    g = []
    for (P, F, N, UV) in geo:
        Pw, Nw = place(P, N, R, t)
        g.append((Pw, F, Nw, box_uv(Pw, Nw) if mat == 'leather' else UV))
    PARTS.append((name, mat, g))

# ---------------------------------------------------------------- montagem
I3 = np.eye(3)
LIE = np.stack([[1, 0, 0], [0, 0, -1], [0, 1, 0.]], 1)    # local y -> -z (para trás), local z -> +y

def rand_creases(r, n, xr, yr, ang, ang_j, L, w, a, bend=1.5):
    out = []
    for _ in range(n):
        out.append((r.uniform(*xr), r.uniform(*yr), ang + r.uniform(-ang_j, ang_j), r.uniform(*L),
                    r.uniform(*w) * 1.2, r.uniform(*a) * 0.7, r.uniform(-bend, bend)))
    return out

def build():
    W, D = 1.86, 0.94
    LEG_H, ARM_TOP, ARM_W = 0.10, 0.57, 0.18
    ARM_IN = W / 2 - ARM_W
    sd = lambda: int(rng.integers(1e6))
    # pés
    for sx in (-1, 1):
        for z in (0.075, D - 0.075):
            add_part('Pe', 'wood', leg(H=LEG_H), I3, np.array([sx * (W / 2 - 0.10), LEG_H / 2, z]))
    # braços: painel de topo, frente emoldurada e duas costuras verticais na lateral externa
    hy = (ARM_TOP - LEG_H) / 2
    for sx in (-1, 1):
        outer = lambda n, p, sx=sx: (n[:, 0] * sx > 0.6) & (p[:, 1] < hy - 0.05)
        seams = [(1, hy - 0.010, None, True),
                 (2, D / 2 - 0.028, lambda n, p: p[:, 1] < hy - 0.034),
                 (2, -0.16, outer), (2, 0.16, outer)]
        add_part('Braco', 'leather', rbox(ARM_W / 2, hy, D / 2, 0.03, bulge=0.006, seams=seams, seed=sd()), I3,
                 np.array([sx * (W / 2 - ARM_W / 2), LEG_H + hy, D / 2]))
    # estrutura do encosto: três costuras verticais no painel traseiro e uma acompanhando o topo
    FB_T, FB_TOP = 0.15, 0.64
    fy = (FB_TOP - LEG_H) / 2
    back = lambda n, p: n[:, 2] < -0.6
    add_part('Encosto', 'leather',
             rbox(ARM_IN + 0.004, fy, FB_T / 2, 0.04, bulge=0.004,
                  seams=[(0, -0.375, back), (0, 0.0, back), (0, 0.375, back),
                         (1, fy - 0.03, lambda n, p: n[:, 1] < 0.5)], seed=sd()),
             I3, np.array([0, LEG_H + fy, FB_T / 2]))
    # base sob as almofadas do assento (recuada da frente)
    add_part('Base', 'leather', rbox(ARM_IN + 0.004, 0.05, (D - 0.035 - FB_T) / 2 + 0.01, 0.012, seed=sd()), I3,
             np.array([0, LEG_H + 0.05, (FB_T + D - 0.035) / 2]))
    SEAT_Y0 = LEG_H + 0.095
    r = np.random.default_rng(31)
    for sx in (-1, 1):
        cx = sx * ARM_IN / 2
        # almofada do assento
        SW, SL, ST = ARM_IN - 0.006, D + 0.012 - FB_T - 0.02, 0.245
        def seat_def(X, Y, Z, SL=SL, SW=SW):
            sf = smoothstep(-SL / 2 + 0.10, -SL / 2, Y)
            top = smoothstep(-0.03, 0.015, Z)
            Z = Z - 0.006 * sf ** 2 * top                                         # quina da frente arredonda
            Z = Z - 0.014 * np.clip(1 - (2 * (Y + 0.06) / SL) ** 2, 0, 1) * np.clip(1 - (2 * X / SW) ** 2, 0, 1) * top
            Z = Z - 0.03 * smoothstep(SL / 2 - 0.25, SL / 2, Y) * top             # comprimido sob o encosto
            return X, Y, Z
        cr = (rand_creases(r, 12, (-SW / 2 + 0.04, SW / 2 - 0.04), (-SL / 2 + 0.005, -SL / 2 + 0.06), math.pi / 2, 0.35,
                           (0.025, 0.06), (0.003, 0.005), (0.0018, 0.0032))
              + rand_creases(r, 7, (-SW / 2 + 0.1, SW / 2 - 0.1), (-SL / 2 + 0.08, 0.15), 0.0, math.pi, (0.08, 0.2),
                             (0.006, 0.011), (0.0012, 0.0022), 3.0)
              + rand_creases(r, 6, (-SW / 2 + 0.06, SW / 2 - 0.06), (-0.25, 0.1), 0.0, 0.4, (0.05, 0.12),
                             (0.004, 0.007), (0.001, 0.0018))
              + [(s * (SW / 2 - 0.01), r.uniform(-0.25, 0.1), r.uniform(-0.3, 0.3), r.uniform(0.02, 0.04), 0.004,
                  r.uniform(0.0015, 0.0025), 0.0) for s in (-1, 1) for _ in range(3)])
        geo = cushion(SW, SL, ST, cr, deform=seat_def, puff=0.12, e_frac=0.17, top_frac=0.24, seed=sd())
        add_part('Assento', 'leather', geo, LIE, np.array([cx, SEAT_Y0 + ST * 0.76, D + 0.012 - SL / 2]))
        # almofada do encosto
        BW, BH, BT = ARM_IN - 0.012, 0.46, 0.27
        def back_def(X, Y, Z, BW=BW, BH=BH):
            t_ = smoothstep(-BH / 4, BH / 2, Y)
            Z = Z + 0.035 * t_ ** 2 * smoothstep(-0.05, 0.05, Z)                # topo rola para frente
            Y = Y + 0.012 * np.clip(1 - (2 * X / BW) ** 2, 0, 1) ** 0.7 * t_      # topo abaulado
            Z = Z - 0.012 * np.clip(1 - (2 * X / BW) ** 2, 0, 1) * np.clip(1 - (2 * (Y + 0.04) / BH) ** 2, 0, 1)
            return X, Y, Z
        cr = (rand_creases(r, 6, (-BW / 2 + 0.08, BW / 2 - 0.08), (-BH / 2 + 0.05, -0.02), 0.0, 0.3, (0.08, 0.2),
                           (0.005, 0.009), (0.0014, 0.0026), 3.0)
              + rand_creases(r, 8, (-BW / 2 + 0.04, BW / 2 - 0.04), (BH / 2 - 0.05, BH / 2 - 0.005), math.pi / 2, 0.4,
                             (0.02, 0.05), (0.003, 0.005), (0.0015, 0.0028))
              + rand_creases(r, 4, (-BW / 2 + 0.1, BW / 2 - 0.1), (-0.1, 0.12), 0.0, math.pi, (0.06, 0.14),
                             (0.006, 0.01), (0.0008, 0.0016)))
        geo = cushion(BW, BH, BT, cr, deform=back_def, puff=0.4, e_frac=0.45, top_frac=0.5, bulge=0.016, seed=sd())
        tilt = rot_axis(np.array([1, 0, 0.]), -math.radians(13))
        add_part('AlmofadaEncosto', 'leather', geo, tilt, np.array([cx, 0.555, FB_T + BT / 2 - 0.01]))

# ---------------------------------------------------------------- texturas
def worley_edges(S, G, seed):
    """Distância F2-F1 de pontos espalhados (ladrilhável): desenha a rede de poros do couro."""
    r = np.random.default_rng(seed)
    pts = (np.arange(G)[:, None, None] + r.random((G, G, 2)) * np.array([1, 1])[None, None]) / G
    pts[..., 0] = (np.arange(G)[:, None] + r.random((G, G))) / G
    pts[..., 1] = (np.arange(G)[None, :] + r.random((G, G))) / G
    v, u = (np.mgrid[0:S, 0:S] + 0.5) / S
    ci, cj = (u * G).astype(int), (v * G).astype(int)
    F1 = np.full((S, S), 9.0); F2 = np.full((S, S), 9.0)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ii, jj = (ci + di) % G, (cj + dj) % G
            px = pts[ii, jj, 0] + np.where(ci + di < 0, -1, np.where(ci + di >= G, 1, 0))
            py = pts[ii, jj, 1] + np.where(cj + dj < 0, -1, np.where(cj + dj >= G, 1, 0))
            d = np.hypot(px - u, py - v)
            F2 = np.where(d < F1, F1, np.minimum(F2, d))
            F1 = np.minimum(F1, d)
    return (F2 - F1) * G

def leather_textures(S=1024):
    sh = (S, S)
    e1 = worley_edges(S, 90, 3)
    e2 = worley_edges(S, 36, 4)
    grain = smoothstep(0.0, 0.32, e1)                           # células do grão estufadas
    coarse = smoothstep(0.0, 0.25, e2)
    patches = fbm(sh, 5, 61, 3)
    fine = fbm(sh, 3, 62, 160)
    h = 0.62 * grain + 0.25 * coarse + 0.13 * fine
    h = blur(h, 0.7)
    col = 0.93 + 0.08 * (patches - 0.5) - 0.06 * (1 - grain) - 0.03 * (1 - coarse)
    col = np.dstack([col * 250, col * 248, col * 246])
    rough = np.clip(0.40 + 0.10 * (patches - 0.5) + 0.10 * (1 - grain) + 0.05 * (1 - coarse), 0, 1)
    mr = np.dstack([np.zeros(sh), rough, np.zeros(sh)]) * 255
    return jpg(col, 90), jpg(normal_map(h, 2.2), 92), jpg(mr, 92)

def leather_textures_poltrona():
    """Mesmo couro da Poltrona de Couro (cor, relevo e ORM extraídos do .glb dela), em tom neutro para
    receber a cor do material, somado a um grão fino (flor do couro) que aparece de perto como na foto."""
    from PIL import Image
    cor = np.asarray(Image.open('pol_couro_cor.jpg').convert('L'), float) / 255
    nrm = np.asarray(Image.open('pol_couro_normal.jpg').convert('RGB'), float) / 255 * 2 - 1
    orm = np.asarray(Image.open('pol_couro_orm.jpg').convert('RGB').resize(cor.shape[::-1], Image.BICUBIC), float) / 255
    S = cor.shape[0]
    # cinza neutro: mantém rachaduras, manchas e variação, sem o caramelo original
    col = np.clip(0.93 + (cor - cor.mean()) / cor.std() * 0.022, 0, 1)
    # grão fino em pebble, repetido 4x dentro do ladrilho
    e = worley_edges(S // 4, 70, 9)
    fine = smoothstep(0.0, 0.35, e) * 0.8 + 0.2 * fbm((S // 4, S // 4), 3, 19, 64)
    fine = np.tile(blur(fine, 0.6), (4, 4))
    nf = normal_map(fine, 1.4) / 255 * 2 - 1
    n = normalize(np.dstack([nrm[..., 0] + nf[..., 0], nrm[..., 1] + nf[..., 1], nrm[..., 2] * nf[..., 2]]))
    col = col * (0.96 + 0.04 * fine)
    rough = np.clip(0.47 + 0.35 * (orm[..., 1] - orm[..., 1].mean()) + 0.06 * (1 - fine), 0, 1)
    ormo = np.dstack([orm[..., 0], rough, np.zeros_like(rough)]) * 255
    half = lambda a: np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((S // 2, S // 2), Image.LANCZOS), float)
    return (jpg(half(np.dstack([col, col, col]) * 255), 88), jpg((n * 0.5 + 0.5) * 255, 86), jpg(half(ormo), 88))

def wood_textures(S=512):
    sh = (S, S)
    v, u = np.mgrid[0:S, 0:S] / S
    warp = fbm(sh, 4, 81, 3)
    rings = 0.5 + 0.5 * np.sin((u * 14 + warp * 2.5) * 2 * math.pi)
    var = 0.9 + 0.15 * fbm(sh, 4, 82, 8)
    col = np.dstack([118 - 26 * rings, 74 - 18 * rings, 42 - 10 * rings]) * var[..., None]
    return jpg(col, 88), jpg(normal_map(rings * 0.4, 2), 88)

def curvature_shade(P, N, F):
    n = len(P)
    E = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    E = np.vstack([E, E[:, ::-1]])
    deg = np.bincount(E[:, 0], minlength=n).astype(float)
    nb = np.zeros_like(P)
    np.add.at(nb, E[:, 0], P[E[:, 1]])
    avg = nb / np.maximum(deg, 1)[:, None]
    el = np.zeros(n)
    np.add.at(el, E[:, 0], np.linalg.norm(P[E[:, 1]] - P[E[:, 0]], axis=1))
    el = el / np.maximum(deg, 1)
    k = ((avg - P) * N).sum(1) / np.maximum(el, 1e-4) ** 2
    for _ in range(2):
        acc = np.zeros(n)
        np.add.at(acc, E[:, 0], k[E[:, 1]])
        k = 0.5 * k + 0.5 * acc / np.maximum(deg, 1)
    c = np.clip(k / 60.0, -1, 1)
    # vincos escurecem; cristas das rugas ficam levemente gastas (mais claras), como no couro usado
    return 1 - 0.10 * np.clip(c, 0, 1) + 0.08 * np.clip(-c, 0, 1)

def main():
    t0 = time.time()
    build()
    allP = np.vstack([g[0] for (_, _, geo) in PARTS for g in geo])
    lo, hi = allP.min(0), allP.max(0)
    off = np.array([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    print('medidas', (hi - lo).round(3))
    chunks = []
    for (name, mat, geo) in PARTS:
        for (P, F, N, UV) in geo:
            chunks.append((name, mat, P + off, F, normalize(N), UV))
    Ps, Ns, Fs, b = [], [], [], 0
    for (_, _, P, F, N, _) in chunks:
        Ps.append(P); Ns.append(N); Fs.append(F + b); b += len(P)
    Pa, Na, Fa = np.vstack(Ps), np.vstack(Ns), np.vstack(Fs)
    ao = bake_ao(Pa, Na, Fa)
    print('AO em %.1fs, %d vértices' % (time.time() - t0, len(Pa)))
    cs = curvature_shade(Pa, Na, Fa)
    meshes = {}
    k = 0
    for (name, mat, P, F, N, UV) in chunks:
        n = len(P)
        shade = np.clip(0.5 + 0.5 * ao[k:k + n], 0, 1) * (cs[k:k + n] if mat == 'leather' else 1)
        k += n
        meshes.setdefault(mat, Mesh()).add(P, F, N=N, UV=UV, C=np.repeat(shade[:, None], 3, 1))
    g = GLB()
    g.j['asset']['generator'] = 'lp-imoveis sofa-couro gen'
    g.j['nodes'][0]['name'] = 'SofaCouro'
    lc, ln, lm = leather_textures_poltrona()
    wc, wn = wood_textures()
    t = {k_: g.image(v) for k_, v in dict(lc=lc, ln=ln, lm=lm, wc=wc, wn=wn).items()}
    m_l = g.material(dict(name='Couro', pbrMetallicRoughness=dict(
        baseColorFactor=list(hex_lin(COR_COURO)) + [1], baseColorTexture=dict(index=t['lc']),
        metallicFactor=0.0, roughnessFactor=1.0, metallicRoughnessTexture=dict(index=t['lm'])),
        normalTexture=dict(index=t['ln'], scale=0.6), occlusionTexture=dict(index=t['lm'], strength=0.6),
        extensions=dict(KHR_materials_clearcoat=dict(clearcoatFactor=0.08, clearcoatRoughnessFactor=0.45))))
    m_w = g.material(dict(name='Madeira', pbrMetallicRoughness=dict(
        baseColorFactor=[1, 1, 1, 1], baseColorTexture=dict(index=t['wc']), metallicFactor=0.0, roughnessFactor=0.5),
        normalTexture=dict(index=t['wn'], scale=0.3)))
    g.j['extensionsUsed'] = ['KHR_materials_clearcoat']
    print('Couro', g.mesh('Couro', meshes['leather'], m_l))
    print('Pes', g.mesh('Pes', meshes['wood'], m_w))
    g.save(OUT)
    print('ok %.1fs' % (time.time() - t0))

main()
