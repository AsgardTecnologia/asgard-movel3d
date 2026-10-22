"""Gera o abajur de mesa com base de pinus torneado (cor natural) e cúpula cônica bege.
Altura total 35 cm; cúpula Ø 9,5 cm em cima, Ø 22 cm embaixo, 12 cm de altura; base Ø 12,5 cm;
fio branco de 1,20 m do soquete até o plugue (2 pinos, NBR 14136). Acompanha lâmpada E27.
Perfil da coluna medido nas fotos do anúncio. Metros, Y para cima, chão em y=0, fio saindo para trás (-Z).

Uso: python gen_abajur.py <saida.glb> [--sem-fio]"""
import sys, math, time
from pathlib import Path
import numpy as np
from PIL import Image
from ficus2 import normalize, vertex_normals, grid_faces, orient, smoothstep, Mesh, jpg, normal_map, GLB, srgb_to_lin

OUT = sys.argv[1]
SEM_FIO = '--sem-fio' in sys.argv
CM = 0.01

# ---------------------------------------------------------------- medidas (cm)
H_TOTAL = 35.0
SH_RT, SH_RB, SH_H = 9.5 / 2, 22.0 / 2, 12.0     # cúpula
SH_Y0 = H_TOTAL - SH_H                           # borda de baixo da cúpula: 23 cm
BASE_R = 12.5 / 2
FIO_TOTAL = 120.0
SOCKET_TOP = 24.6

# ---------------------------------------------------------------- perfis 2D (r, y)
def line(a, b):
    return np.array([a, b], float)

def arc(c, rx, ry, a0, a1, n=16):
    t = np.radians(np.linspace(a0, a1, n))
    return np.stack([c[0] + rx * np.cos(t), c[1] + ry * np.sin(t)], 1)

def spline(pts, n=24):
    """Catmull-Rom centrípeta passando pelos pontos."""
    P = np.array(pts, float)
    P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1:i + 3]
        t0 = 0
        t1 = t0 + np.linalg.norm(p1 - p0) ** 0.5
        t2 = t1 + np.linalg.norm(p2 - p1) ** 0.5
        t3 = t2 + np.linalg.norm(p3 - p2) ** 0.5
        for t in np.linspace(t1, t2, n, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out.append(P[-2])
    return np.array(out)

def build_profile(pieces, ds=0.09, sharp_deg=28):
    """Junta os trechos, reamostra por comprimento de arco e calcula normais 2D.
    Juntas com ângulo maior que sharp_deg viram quinas vivas (vértice duplicado)."""
    runs = [np.asarray(pieces[0], float)]
    for p in pieces[1:]:
        p = np.asarray(p, float)
        a = runs[-1]
        t0 = a[-1] - a[-2]; t1 = p[1] - p[0]
        ang = math.degrees(math.acos(np.clip(np.dot(t0, t1) / np.linalg.norm(t0) / np.linalg.norm(t1), -1, 1)))
        if ang > sharp_deg:
            runs.append(p)
        else:
            runs[-1] = np.vstack([a, p[1:]])
    R, N, S = [], [], []
    s_acc = 0.0
    for run in runs:
        seg = np.linalg.norm(np.diff(run, axis=0), axis=1)
        keep = np.concatenate([[True], seg > 1e-9])
        run = run[keep]
        s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(run, axis=0), axis=1))])
        k = max(2, int(math.ceil(s[-1] / ds)) + 1)
        ss = np.linspace(0, s[-1], k)
        pts = np.stack([np.interp(ss, s, run[:, 0]), np.interp(ss, s, run[:, 1])], 1)
        tg = np.gradient(pts, axis=0)
        tg /= np.linalg.norm(tg, axis=1, keepdims=True)
        R.append(pts); N.append(np.stack([tg[:, 1], -tg[:, 0]], 1)); S.append(ss + s_acc)
        s_acc += s[-1]
    return np.vstack(R), np.vstack(N), np.concatenate(S)

def lathe(prof, thetas, uvfun):
    """Revolve o perfil (r, y) em torno de Y. Ângulo θ: x = r cos θ, z = -r sin θ."""
    rr, nn, ss = prof
    th = np.asarray(thetas, float)
    c, s = np.cos(th), -np.sin(th)
    P = np.stack([rr[:, 0:1] * c, np.repeat(rr[:, 1:2], len(th), 1), rr[:, 0:1] * s], -1).reshape(-1, 3)
    N = np.stack([nn[:, 0:1] * c, np.repeat(nn[:, 1:2], len(th), 1), nn[:, 0:1] * s], -1).reshape(-1, 3)
    TH = np.tile(th, len(rr)); SS = np.repeat(ss, len(th)); RR = np.repeat(rr[:, 0], len(th)); YY = np.repeat(rr[:, 1], len(th))
    UV = uvfun(TH, SS, RR, YY)
    F = grid_faces(len(rr), len(th))
    area = np.linalg.norm(np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]), axis=1)
    F = F[area > 1e-10]
    return P, orient(P, F, normalize(N)), normalize(N), UV, TH

TH_WOOD = np.linspace(0, 2 * math.pi, 113)

# ---------------------------------------------------------------- base (disco torneado)
def base_profile():
    R = BASE_R
    return build_profile([
        line((0, 0), (R - 0.25, 0)),
        arc((R - 0.25, 0.25), 0.25, 0.25, -90, 0, 10),
        line((R, 0.25), (R, 0.72)),
        line((R, 0.72), (R - 0.08, 0.80)),                  # frisos (sulco em V)
        line((R - 0.08, 0.80), (R - 0.03, 0.90)),
        arc((R - 0.80, 0.90), 0.77, 0.95, 0, 90, 28),        # quarto de círculo (óvalo)
        line((R - 0.80, 1.85), (5.05, 1.85)),
        line((5.05, 1.85), (4.85, 1.92)),                     # degrau até o disco de cima
        line((4.85, 1.92), (4.85, 2.25)),
        arc((4.50, 2.25), 0.35, 0.35, 0, 90, 14),
        line((4.50, 2.60), (0, 2.60)),
    ])

# ---------------------------------------------------------------- coluna torneada (medida nas fotos)
def column_profile():
    return build_profile([
        line((0, 2.6), (2.15, 2.6)),
        spline([(2.15, 2.6), (2.36, 2.75), (2.48, 3.1), (2.5, 3.55), (2.46, 3.95), (2.34, 4.32)]),   # pé (bolacha)
        line((2.34, 4.32), (2.02, 4.42)),
        spline([(2.02, 4.42), (2.15, 4.56), (2.2, 4.85), (2.17, 5.15), (2.05, 5.35), (1.9, 5.45)]),  # anel
        spline([(1.9, 5.45), (1.6, 5.66), (1.43, 6.0), (1.37, 6.3), (1.42, 6.65), (1.55, 6.95), (1.68, 7.2)]),
        spline([(1.68, 7.2), (1.8, 7.34), (1.85, 7.6), (1.83, 7.85), (1.72, 8.0)]),               # anel do meio
        line((1.72, 8.0), (1.52, 8.08)),
        spline([(1.52, 8.08), (1.62, 8.32), (1.92, 8.62), (2.25, 9.1), (2.44, 9.7), (2.48, 10.2), (2.43, 10.9),
                (2.24, 11.8), (1.93, 12.8), (1.6, 13.8), (1.33, 14.6), (1.17, 15.2), (1.14, 15.5), (1.18, 15.9),
                (1.32, 16.4), (1.52, 16.8), (1.64, 17.05), (1.64, 17.45)]),                            # balaústre
        line((1.64, 17.45), (1.55, 17.5)),
        spline([(1.55, 17.5), (1.67, 17.6), (1.71, 17.75), (1.67, 17.89), (1.56, 17.96)]),          # anéis duplos
        spline([(1.56, 17.96), (1.65, 18.06), (1.68, 18.18), (1.63, 18.3), (1.5, 18.38)]),
        spline([(1.5, 18.38), (1.32, 18.6), (1.24, 18.9), (1.27, 19.3), (1.42, 19.7), (1.68, 20.02),
                (1.95, 20.22), (2.08, 20.32)]),                                                       # garganta
        line((2.08, 20.32), (2.08, 20.95)),                                                           # capitel
        arc((1.83, 20.95), 0.25, 0.25, 0, 90, 10),
        line((1.83, 21.2), (0, 21.2)),
    ])

# ---------------------------------------------------------------- madeira: a mesma da Mesinha Redonda
AQUI = Path(__file__).resolve().parent
WU, WV = 90.0, 22.5          # como na cama: a textura cobre 90 x 22,5 cm (u = sentido do veio)
WV_COL = 2 * math.pi * 2.48  # ladrilho refeito com a circunferência do bojo: uma volta = um ladrilho

def wood_maps():
    """Texturas da Mesinha Redonda (mesmo tom e verniz), com o ladrilho encurtado no sentido transversal para
    WV_COL: a faixa final é misturada com o que vem antes da linha 0 (a textura original emenda nesse sentido)."""
    d = AQUI / 'tex_mesinha'
    out = []
    for n in ('cor', 'normal', 'orm'):
        a = np.asarray(Image.open(d / f'estrutura_{n}.jpg').convert('RGB'), float)
        H = a.shape[0]
        p = int(round(H * WV_COL / WV)); band = 48
        t = smoothstep(p - band, p, np.arange(p))[:, None, None]
        tile = a[:p] * (1 - t) + a[(np.arange(p) - p) % H] * t
        img = Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).resize((a.shape[1], H), Image.LANCZOS)
        out.append(jpg(np.asarray(img, float), 90))
    return out

def column_uv(TH, SS, RR, YY):
    """Veio ao longo de Y; uma volta da coluna = um ladrilho, sem costura."""
    return np.stack([YY / WU, TH / (2 * math.pi)], 1)

def base_uv(TH, SS, RR, YY):
    """Disco tirado de tábua: veio ao longo de X, projeção de cima."""
    X, Z = RR * np.cos(TH), -RR * np.sin(TH)
    return np.stack([X / WU + 0.31, Z / WV_COL + 0.27], 1)

# ---------------------------------------------------------------- cúpula (cone de polipropileno com debrum)
def shade_profile():
    d = np.array([SH_RT - SH_RB, SH_H]); L = np.linalg.norm(d); d /= L
    nrm = np.array([d[1], -d[0]])
    m0 = np.array([SH_RB, SH_Y0])
    def half(l):
        hem = np.maximum(1 - smoothstep(0.62, 0.68, l), smoothstep(L - 0.58, L - 0.52, l))
        return 0.025 + 0.05 * hem
    l = np.concatenate([np.linspace(0, 0.55, 8), np.linspace(0.58, 0.72, 10), np.linspace(0.75, L - 0.62, 80),
                        np.linspace(L - 0.6, L - 0.5, 10), np.linspace(L - 0.47, L, 7)])
    m = m0 + l[:, None] * d
    outer = m + half(l)[:, None] * nrm
    inner = (m - half(l)[:, None] * nrm)[::-1]
    def cap(c, h, a_from):
        a = np.linspace(a_from, a_from + math.pi, 9)[1:-1]
        base_a = math.atan2(nrm[1], nrm[0])
        return np.stack([c[0] + h * np.cos(base_a + a), c[1] + h * np.sin(base_a + a)], 1)
    top = cap(m[-1], half(l[-1:])[0], 0)
    bot = cap(m[0], half(l[:1])[0], math.pi)
    loop = np.vstack([outer, top, inner, bot, outer[:1]])
    return build_profile([loop], ds=0.28, sharp_deg=179)

APEX_Y = SH_Y0 + SH_RB * SH_H / (SH_RB - SH_RT)
SIN_A = (SH_RB - SH_RT) / math.hypot(SH_RB - SH_RT, SH_H)
SHADE_TILE = 6.0

def shade_uv(TH, SS, RR, YY):
    rho = np.hypot(RR, APEX_Y - YY)
    ph = TH * SIN_A
    return np.stack([rho * np.cos(ph), rho * np.sin(ph)], 1) / SHADE_TILE

def build_shade():
    th = np.unique(np.concatenate([np.linspace(0, 2 * math.pi, 193), np.linspace(0, 0.21, 40)]))
    prof = shade_profile()
    P, F, N, UV, TH = lathe(prof, th, shade_uv)
    # emenda vertical: aba sobreposta de 8 mm na face de fora
    r = np.hypot(P[:, 0], P[:, 2])
    arcl = r * TH
    outer = (N[:, 0] * P[:, 0] + N[:, 2] * P[:, 2]) / np.maximum(r, 1e-9) > 0.5
    w = smoothstep(0.0, 0.04, arcl) * (1 - smoothstep(0.76, 0.8, arcl)) * outer
    P = P + N * (0.03 * w)[:, None]
    return P, F, N, UV

def linen_textures(S=1024, threads=64):
    """Polipropileno com textura de linho: trama fina, ladrilhável. Em tom neutro claro: a cor vem do material."""
    rng = np.random.default_rng(5)
    y, x = np.mgrid[0:S, 0:S] / S
    jx = np.interp(x[0], np.linspace(0, 1, threads + 1), np.r_[rng.normal(0, 0.12, threads), 0])
    jy = np.interp(y[:, 0], np.linspace(0, 1, threads + 1), np.r_[rng.normal(0, 0.12, threads), 0])
    fx = (x * threads + jx[None, :]); fy = (y * threads + jy[:, None])
    warp = np.sin(math.pi * (fx % 1)) ** 0.7
    weft = np.sin(math.pi * (fy % 1)) ** 0.7
    on = ((np.floor(fx) + np.floor(fy)) % 2).astype(bool)
    thick_x = 0.75 + 0.5 * rng.random(threads)[np.floor(fx).astype(int) % threads]
    thick_y = 0.75 + 0.5 * rng.random(threads)[np.floor(fy).astype(int) % threads]
    h = np.where(on, warp * thick_x, weft * thick_y)
    slub = 0.5 + 0.5 * np.sin(2 * math.pi * (y * 3 + rng.random())) * np.sin(2 * math.pi * (x * 2))
    col = 255 * (0.955 + 0.045 * h) * (0.985 + 0.015 * slub)
    col = np.dstack([col, col, col])
    nrm = normal_map(h, 1.4)
    rough = 0.8 + 0.08 * (1 - h)
    mr = np.dstack([np.ones_like(rough), rough, np.zeros_like(rough)]) * 255
    return jpg(col, 88), jpg(nrm, 88), jpg(mr, 88)

# ---------------------------------------------------------------- soquete, lâmpada e armação
def socket_profile():
    return build_profile([
        line((0, 21.2), (1.0, 21.2)),
        line((1.0, 21.2), (1.0, 21.6)),
        line((1.0, 21.6), (1.4, 21.66)),
        arc((1.4, 21.74), 0.08, 0.08, -90, 0, 6),
        line((1.48, 21.74), (1.48, 24.2)),
        line((1.48, 24.2), (1.6, 24.25)),          # anel rosqueado que prende a armação
        line((1.6, 24.25), (1.6, SOCKET_TOP - 0.06)),
        arc((1.54, SOCKET_TOP - 0.06), 0.06, 0.06, 0, 90, 6),
        line((1.54, SOCKET_TOP), (1.38, SOCKET_TOP)),
        line((1.38, SOCKET_TOP), (1.38, 22.0)),
        line((1.38, 22.0), (0, 22.0)),
    ], ds=0.05)

def bulb_glass_profile():
    return build_profile([
        line((0, 24.62), (1.27, 24.62)),
        spline([(1.27, 24.62), (1.34, 25.1), (1.55, 25.75), (1.98, 26.5), (2.33, 27.3), (2.48, 28.0), (2.5, 28.6)]),
        arc((0, 28.6), 2.5, 2.5, 0, 90, 30),
    ], ds=0.08)

def bulb_base():
    """Rosca E27 (passo 3,6 mm), isolador de vidro preto e contato central."""
    th = np.linspace(0, 2 * math.pi, 97)
    ys = np.linspace(22.5, 24.45, 64)
    T, Y = np.meshgrid(th, ys)
    ph = 2 * math.pi * ((Y - 22.5) / 0.36 - T / (2 * math.pi))
    edge = smoothstep(22.5, 22.65, Y) * (1 - smoothstep(24.3, 24.45, Y))
    R = 1.27 + 0.065 * np.cos(ph) * edge
    P = np.stack([R * np.cos(T), Y, -R * np.sin(T)], -1).reshape(-1, 3)
    F = grid_faces(len(ys), len(th))
    N = vertex_normals(P, F)
    out = {'rosca': (P, orient(P, F, N), N)}
    ins = build_profile([line((0, 22.05), (0.38, 22.05)), arc((0.38, 22.12), 0.07, 0.07, -90, 0, 5),
                         line((0.45, 22.12), (0.45, 22.2)), line((0.45, 22.2), (0.95, 22.22)),
                         spline([(0.95, 22.22), (1.15, 22.32), (1.24, 22.5)])], ds=0.03)
    Pi, Fi, Ni, _, _ = lathe(ins, TH_WOOD, lambda *a: np.zeros((len(a[0]), 2)))
    out['isolador'] = (Pi, Fi, Ni)
    return out

def frame_along(path):
    t = np.gradient(path, axis=0); t = normalize(t)
    up = np.array([0, 1.0, 0])
    side = np.cross(t, up)
    bad = np.linalg.norm(side, axis=1) < 1e-6
    side[bad] = np.cross(t[bad], [1, 0, 0])
    side = normalize(side)
    return t, side, normalize(np.cross(side, t))

def tube(path, section):
    """section: (k,2) contorno em (lado, cima)."""
    path = np.asarray(path, float)
    _, side, up = frame_along(path)
    k = len(section)
    P = (path[:, None, :] + section[None, :, 0:1] * side[:, None, :] + section[None, :, 1:2] * up[:, None, :]).reshape(-1, 3)
    F = grid_faces(len(path), k, closed_v=True)
    C = np.repeat(path, k, 0)
    N = normalize(P - C)
    return P, orient(P, F, N), N

def circle(r, k=10):
    a = np.linspace(0, 2 * math.pi, k, endpoint=False)
    return np.stack([r * np.cos(a), r * np.sin(a)], 1)

def build_frame():
    parts = []
    # arruela presa embaixo do anel do soquete
    wp = build_profile([line((1.49, 24.17), (2.4, 24.17)), arc((2.4, 24.21), 0.04, 0.04, -90, 90, 6),
                        line((2.4, 24.25), (1.49, 24.25)), line((1.49, 24.25), (1.49, 24.17))], ds=0.05)
    P, F, N, _, _ = lathe(wp, TH_WOOD, lambda *a: np.zeros((len(a[0]), 2)))
    parts.append((P, F, N))
    wr = 0.09
    def r_in(y):        # face interna da cúpula na altura y
        return SH_RB + (SH_RT - SH_RB) * (y - SH_Y0) / SH_H - 0.095 / math.cos(math.asin(SIN_A))
    y_top = H_TOTAL - 0.25
    ring_r = r_in(y_top) - wr
    a = np.linspace(0, 2 * math.pi, 145)
    for yy, rr in ((y_top, ring_r), (SH_Y0 + 0.3, r_in(SH_Y0 + 0.3) - wr)):
        path = np.stack([rr * np.cos(a), np.full_like(a, yy), -rr * np.sin(a)], 1)
        P, F, N = tube(path, circle(wr, 10))
        parts.append((P, F, N))
    for k in range(3):
        ang = math.radians(90 + 120 * k)
        d = np.array([math.cos(ang), 0, -math.sin(ang)])
        p0 = d * 2.25 + [0, 24.21, 0]
        p1 = d * (ring_r - 0.02) + [0, y_top, 0]
        t = np.linspace(0, 1, 30)[:, None]
        path = p0 * (1 - t) + p1 * t
        P, F, N = tube(path, circle(wr, 10))
        parts.append((P, F, N))
    return parts

# ---------------------------------------------------------------- fio paralelo branco e plugue 2P
def cord_section(k=20):
    a = np.linspace(0, 2 * math.pi, k, endpoint=False)
    x = 0.27 * np.cos(a)
    y = 0.135 * np.sin(a) * (1 - 0.22 * np.exp(-(x / 0.07) ** 2))
    return np.stack([x, y], 1)

def catmull_xz(ctrl, n=2000):
    pts = spline([tuple(c) for c in ctrl], n=60)
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    return pts, s

PLUG_L = 3.4

def build_cord():
    # trecho aparente: sai por baixo da base (atrás) e fica solto sobre a mesa
    internal = (21.4 - 0.15) + 4.8              # do soquete, descendo pela coluna e pelo canal sob a base
    target = FIO_TOTAL - internal
    ctrl = np.array([(0, -4.8), (0, -8.5), (0.9, -13), (5.5, -17.2), (12.5, -19), (16.2, -23.5), (13.8, -29.5),
                     (6, -31.2), (-3.5, -29.8), (-11.5, -31.5), (-15, -37.5), (-11.5, -43.0), (-4, -45.0)])
    for _ in range(30):
        pts, s = catmull_xz(ctrl)
        if abs(s[-1] - target) < 0.05:
            break
        ctrl = ctrl[0] + (ctrl - ctrl[0]) * (target / s[-1])
    n = int(s[-1] / 0.25)
    ss = np.linspace(0, s[-1], n)
    xz = np.stack([np.interp(ss, s, pts[:, 0]), np.interp(ss, s, pts[:, 1])], 1)
    plug_y = 0.72
    y = 0.135 + (plug_y - 0.135) * smoothstep(s[-1] - 3.5, s[-1] - 0.2, ss)
    path = np.stack([xz[:, 0], y, xz[:, 1]], 1)
    path = np.vstack([path, path[-1] + normalize(path[-1] - path[-2]) * 0.6])   # entra no plugue
    P, F, N = tube(path, cord_section())
    end = path[-2]
    fwd = normalize(np.array([path[-1][0] - path[-3][0], 0, path[-1][2] - path[-3][2]]))
    return (P, F, N), end, fwd, s[-1] + internal

def build_plug(end, fwd):
    """Plugue macho 2 pinos 10 A: corpo achatado com pega estriada, pinos Ø 4 mm × 19 mm, entre centros 19 mm."""
    side = normalize(np.cross(fwd, [0, 1.0, 0])); up = np.array([0, 1.0, 0])
    a_pts = np.concatenate([np.linspace(0, 1.2, 40), np.linspace(1.22, 1.9, 24), np.linspace(1.92, PLUG_L - 0.22, 12),
                            PLUG_L - 0.22 + 0.22 * np.sin(np.linspace(0, math.pi / 2, 10)[1:])])
    def half(a):
        grip = 0.03 * (np.cos(a * 2 * math.pi / 0.22) * 0.5 + 0.5) * (a < 1.15) * (a > 0.1)
        t = smoothstep(1.15, 1.85, a)
        wx = 0.36 + 0.07 * a / 1.2 + (1.45 - 0.43) * t + grip
        wy = 0.24 + 0.05 * a / 1.2 + (0.7 - 0.29) * t + grip
        f = np.where(a > PLUG_L - 0.22, 0.22 * (1 - np.cos(np.arcsin(np.clip((a - (PLUG_L - 0.22)) / 0.22, 0, 1)))), 0)
        return wx - f, wy - f
    k = 40
    ang = np.linspace(0, 2 * math.pi, k, endpoint=False)
    ce, se = np.cos(ang), np.sin(ang)
    ex = 2 / 4.0
    sx = np.sign(ce) * np.abs(ce) ** ex; sy = np.sign(se) * np.abs(se) ** ex
    wx, wy = half(a_pts)
    start = end - fwd * 0.3
    P = (start[None, None, :] + a_pts[:, None, None] * fwd + (wx[:, None] * sx)[..., None] * side
         + (wy[:, None] * sy)[..., None] * up).reshape(-1, 3)
    F = grid_faces(len(a_pts), k, closed_v=True)
    # tampas (frente plana e fundo junto ao fio)
    nr = len(a_pts)
    c_front = len(P); P = np.vstack([P, start + PLUG_L * fwd])
    c_back = len(P); P = np.vstack([P, start])
    j = np.arange(k); j2 = (j + 1) % k
    F = np.vstack([F, np.stack([np.full(k, c_front), (nr - 1) * k + j2, (nr - 1) * k + j], 1),
                   np.stack([np.full(k, c_back), j, j2], 1)])
    N = vertex_normals(P, F)
    ctr = start[None, :] + ((P - start) @ fwd)[:, None] * fwd
    F = orient(P, F, normalize(P - ctr + 1e-6 * fwd))
    N = vertex_normals(P, F)
    body = (P, F, N)
    pins = []
    for sgn in (-1, 1):
        o = start + PLUG_L * fwd + side * sgn * 0.95
        pr = build_profile([line((0, -0.1), (0.2, -0.1)), line((0.2, -0.1), (0.2, 1.75)),
                            arc((0.1, 1.75), 0.1, 0.15, 0, 90, 8), line((0.1, 1.9), (0, 1.9))], ds=0.04)
        Pp, Fp, Np, _, _ = lathe(pr, np.linspace(0, 2 * math.pi, 33), lambda *a: np.zeros((len(a[0]), 2)))
        M = np.stack([side, fwd, up], 0)          # eixo y do torneado -> frente do plugue
        Pp = o + Pp @ M; Np = Np @ M
        pins.append((Pp, Fp, Np))
    return body, pins

# ---------------------------------------------------------------- oclusão ambiente (mapas de profundidade)
def bake_ao(P, N, F, n_dirs=192, res=1100, ext=0.34, bias=0.0012):
    """Como ao.bake_ao, em escala de abajur (metros, peças de milímetros)."""
    tri = P[F]
    occ = np.vstack([P, tri.mean(1), (tri[:, 0] + tri[:, 1]) / 2, (tri[:, 1] + tri[:, 2]) / 2, (tri[:, 2] + tri[:, 0]) / 2])
    i = np.arange(n_dirs) + 0.5
    phi = np.arccos(1 - 2 * i / n_dirs); th = math.pi * (1 + 5 ** 0.5) * i
    dirs = np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)
    vis = np.zeros(len(P)); wsum = np.zeros(len(P))
    Pq = P + N * 0.0006
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
        np.maximum.at(dm, pix(occ), occ @ d)
        dm = dm.reshape(res, res)
        pad = np.pad(dm, 1, constant_values=-np.inf)
        dm = np.max(np.stack([pad[i:i + res, j:j + res] for i in range(3) for j in range(3)]), 0).reshape(-1)
        Q = Pq[mask]; c = cos[mask]
        blocked = dm[pix(Q)] > Q @ d + bias + 0.0025 * np.sqrt(np.clip(1 - c * c, 0, 1))
        if d[1] < -0.05:
            blocked |= (Q[:, 1] / -d[1]) < 0.06
        vis[mask] += c * (~blocked); wsum[mask] += c
    return vis / np.maximum(wsum, 1e-9)

# ---------------------------------------------------------------- montagem
# cores da cúpula (a textura é neutra clara); iguais às do `complemento` do abajur em src/data/moveis.ts
CUPULAS = {'Bege': '#dad2c2', 'Branca': '#f1efea', 'Cinza': '#a9a7a2', 'Preta': '#2f2e2c'}

def hex_lin(h):
    return list(srgb_to_lin([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]))

def main():
    t0 = time.time()
    PARTS = []      # (nó, material, P, F, N, UV) em cm
    def add(node, mat, P, F, N, UV=None):
        PARTS.append((node, mat, P, F, N, np.zeros((len(P), 2)) if UV is None else UV))
    bp, cp = base_profile(), column_profile()
    P, F, N, UV, _ = lathe(bp, TH_WOOD, base_uv); add('Base', 'madeira', P, F, N, UV)
    P, F, N, UV, _ = lathe(cp, TH_WOOD, column_uv); add('Coluna', 'madeira', P, F, N, UV)
    P, F, N, UV = build_shade(); add('Cupula', 'cupula', P, F, N, UV)
    sp = socket_profile()
    P, F, N, _, _ = lathe(sp, TH_WOOD, lambda *a: np.zeros((len(a[0]), 2))); add('Soquete', 'soquete', P, F, N)
    for P, F, N in build_frame():
        add('Armacao', 'armacao', P, F, N)
    P, F, N, _, _ = lathe(bulb_glass_profile(), TH_WOOD, lambda *a: np.zeros((len(a[0]), 2))); add('Lampada', 'vidro', P, F, N)
    bb = bulb_base()
    add('Lampada', 'rosca', *bb['rosca']); add('Lampada', 'isolador', *bb['isolador'])
    if not SEM_FIO:
        cord, end, fwd, total = build_cord()
        print('fio: %.1f cm do soquete ao plugue' % total)
        add('Fio', 'fio', *cord)
        body, pins = build_plug(end, fwd)
        add('Plugue', 'plugue', *body)
        for pn in pins:
            add('Plugue', 'pinos', *pn)

    Pa = np.vstack([p[2] for p in PARTS]) * CM
    Na = normalize(np.vstack([p[4] for p in PARTS]))
    Fs, b = [], 0
    for p in PARTS:
        Fs.append(p[3] + b); b += len(p[2])
    lo, hi = Pa.min(0), Pa.max(0)
    print('medidas (cm)', ((hi - lo) / CM).round(2))
    shift = np.array([-(lo[0] + hi[0]) / 2, 0, -(lo[2] + hi[2]) / 2])
    ao = bake_ao(Pa + shift, Na, np.vstack(Fs))
    print('AO %.1fs, %d vértices, %d triângulos' % (time.time() - t0, len(Pa), sum(len(f) for f in Fs)))

    meshes, k = {}, 0
    floor_ao = {'madeira': 0.75, 'cupula': 0.55, 'fio': 0.45, 'plugue': 0.45}
    for (node, mat, P, F, N, UV) in PARTS:
        n = len(P); a = ao[k:k + n]; k += n
        lo_ = floor_ao.get(mat, 0.5)
        shade = np.clip(lo_ + (1 - lo_) * a, 0, 1)
        meshes.setdefault((node, mat), Mesh()).add(P * CM, F, N=N, UV=UV, C=np.repeat(shade[:, None], 3, 1), fix=False)

    g = GLB()
    g.j['asset']['generator'] = 'lp-imoveis abajur gen'
    g.j['nodes'][0]['name'] = 'AbajurMadeira'
    tw = [g.image(x) for x in wood_maps()]
    lc, ln, lm = linen_textures()
    tl = [g.image(x) for x in (lc, ln, lm)]
    mats = {
        'madeira': g.material(dict(name='Madeira', pbrMetallicRoughness=dict(
            baseColorFactor=[1, 1, 1, 1], baseColorTexture=dict(index=tw[0]), metallicFactor=0.0, roughnessFactor=1.0,
            metallicRoughnessTexture=dict(index=tw[2])), normalTexture=dict(index=tw[1], scale=0.4),
            occlusionTexture=dict(index=tw[2], strength=0.7))),
        'cupula': g.material(dict(name='Cupula', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin(CUPULAS['Bege']) + [1], baseColorTexture=dict(index=tl[0]), metallicFactor=0.0,
            roughnessFactor=1.0, metallicRoughnessTexture=dict(index=tl[2])), normalTexture=dict(index=tl[1], scale=0.45))),
        'soquete': g.material(dict(name='Soquete', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#ebe3d2') + [1], metallicFactor=0.0, roughnessFactor=0.42))),
        'armacao': g.material(dict(name='Armacao', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#e9e6df') + [1], metallicFactor=0.0, roughnessFactor=0.38))),
        'vidro': g.material(dict(name='Lampada_Vidro', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#f4f3ef') + [1], metallicFactor=0.0, roughnessFactor=0.3))),
        'rosca': g.material(dict(name='Lampada_Rosca', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#c9c9c6') + [1], metallicFactor=1.0, roughnessFactor=0.28))),
        'isolador': g.material(dict(name='Lampada_Isolador', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#141414') + [1], metallicFactor=0.0, roughnessFactor=0.15))),
        'fio': g.material(dict(name='Fio', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#f1f0ec') + [1], metallicFactor=0.0, roughnessFactor=0.4))),
        'plugue': g.material(dict(name='Plugue', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#f2f1ed') + [1], metallicFactor=0.0, roughnessFactor=0.45))),
        'pinos': g.material(dict(name='Plugue_Pinos', pbrMetallicRoughness=dict(
            baseColorFactor=hex_lin('#d8d4c8') + [1], metallicFactor=1.0, roughnessFactor=0.25))),
    }
    # um nó por peça; peças com mais de um material viram primitivas do mesmo mesh
    nodes = {}
    for (node, mat), m in meshes.items():
        g.mesh(node, m, mats[mat])
        mi = len(g.j['meshes']) - 1
        if node in nodes:
            g.j['meshes'][nodes[node]]['primitives'] += g.j['meshes'][mi]['primitives']
            g.j['meshes'].pop(); g.j['nodes'].pop(); g.j['nodes'][0]['children'].pop()
        else:
            nodes[node] = mi
    g.save(OUT)
    print('ok %.1fs' % (time.time() - t0), OUT)

main()
