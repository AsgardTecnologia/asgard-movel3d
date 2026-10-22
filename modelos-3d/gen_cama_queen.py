"""Gera a cama Queen de madeira maciça finger (pinus tingido nogueira, acabamento fosco) com cabeceira de palitos.
173 L x 210 C x 94 A cm; lateral de 15 cm com topo a 38 cm; pés de 23 cm; palitos de 42 cm.
Metros, Y para cima, pés da cama em +Z, cabeceira em -Z, chão em y=0.

Uso: python gen_cama_queen.py <saida.glb> [--decorada]
--decorada inclui colchão Queen 158x198x25, edredom, travesseiros e manta, como nas fotos do anúncio."""
import sys, math, time
import numpy as np
from PIL import Image
from ficus2 import normalize, vertex_normals, grid_faces, orient, rot_axis, smoothstep, Mesh, fbm, blur, jpg, normal_map, GLB, srgb_to_lin
from ao import bake_ao

OUT = sys.argv[1]
DECORADA = '--decorada' in sys.argv
rng = np.random.default_rng(31)

# ---------------------------------------------------------------- medidas
W, L, H = 1.73, 2.10, 0.94
R = 0.031                    # raio dos pés/colunas (Ø 6,2 cm)
TOPO = 0.38                  # topo da lateral
CAP_T, CAP_W = 0.022, 0.07   # tampa (aba) da lateral: 7 cm de largura
RAIL_Y0 = TOPO - 0.15        # lateral de 15 cm
RAIL_T = 0.022
RAIL_IN = 0.006              # recuo da face da lateral sob a aba
XC = W / 2 - R               # centro das colunas
ZP = L / 2 - R               # pés (frente)
ZH = -L / 2 + R              # colunas da cabeceira (trás)
TOPRAIL_T = 0.032
SPINDLE_Y1 = H - TOPRAIL_T
SPINDLE_Y0 = SPINDLE_Y1 - 0.42
N_SPINDLES = 16
SLAT_TOP = 0.30              # o colchão apoia aqui
MATT = (1.58, 0.25, 1.98)

PARTS = []   # (nome, material, P, F, N, UV)

def add(name, mat, P, F, N, UV):
    PARTS.append((name, mat, np.asarray(P, float), np.asarray(F), normalize(np.asarray(N, float)), np.asarray(UV, float)))

# ---------------------------------------------------------------- madeira: geometria
WU, WV = 0.9, 0.225          # a textura da madeira cobre 90 x 22,5 cm (u = sentido do veio)

def rbox(size, r, center, grain, seg=3, step=0.025, uv=None, seed=None):
    """Caixa com quinas arredondadas, subdividida para o AO por vértice. grain: eixo do veio (0,1,2)."""
    h = np.array(size, float) / 2
    r = min(r, h.min() * 0.95)
    angs = np.linspace(0, math.pi / 4, seg + 1)
    def coords(hh):
        inner = hh - r
        arc = inner + r * np.tan(angs)
        n = max(1, int(math.ceil(2 * inner / step)))
        mid = np.linspace(-inner, inner, n + 1)[1:-1] if inner > 1e-6 else np.zeros(0)
        c = np.concatenate([-arc[::-1], mid, arc])
        return np.unique(np.round(c, 7))
    C = [coords(x) for x in h]
    r_ = np.random.default_rng(seed if seed is not None else int(rng.integers(1 << 30)))
    off = r_.uniform(0, 4, 2)
    for ax in range(3):
        for sgn in (-1, 1):
            a1, a2 = [k for k in range(3) if k != ax]
            T1, T2 = np.meshgrid(C[a1], C[a2], indexing='ij')
            p = np.zeros(T1.shape + (3,))
            p[..., ax] = sgn * h[ax]; p[..., a1] = T1; p[..., a2] = T2
            p = p.reshape(-1, 3)
            q = np.clip(p, -(h - r), h - r)
            n = normalize(p - q)
            P = q + r * n + center
            if uv == 'fabric':
                UV = np.stack([P[:, a1], P[:, a2]], 1)
            elif ax == grain:
                UV = np.stack([P[:, a1] / WU, P[:, a2] / WV], 1) * 0.6 + off
            else:
                o = 3 - grain - ax
                UV = np.stack([P[:, grain] / WU, P[:, o] / WV], 1) + off
            F = grid_faces(len(C[a1]), len(C[a2]))
            yield P, orient(P, F, n), n, UV

def add_box(name, mat, size, r, center, grain, **kw):
    for P, F, N, UV in rbox(size, r, np.asarray(center, float), grain, **kw):
        add(name, mat, P, F, N, UV)

def lathe(profile, cx, cz, seg=48, seed=None):
    """Sólido de revolução em torno do eixo Y. profile: [(raio, y, (nr, ny))] de baixo para cima."""
    r_ = np.random.default_rng(seed if seed is not None else int(rng.integers(1 << 30)))
    off = r_.uniform(0, 4, 2)
    ang = np.linspace(0, 2 * math.pi, seg + 1) + r_.uniform(0, 6.28)
    rad = np.array([p[0] for p in profile]); ys = np.array([p[1] for p in profile])
    nr = np.array([p[2][0] for p in profile]); ny = np.array([p[2][1] for p in profile])
    c, s = np.cos(ang), np.sin(ang)
    P = np.stack([cx + rad[:, None] * c, np.repeat(ys[:, None], seg + 1, 1), cz + rad[:, None] * s], -1).reshape(-1, 3)
    N = np.stack([nr[:, None] * c, np.repeat(ny[:, None], seg + 1, 1), nr[:, None] * s], -1).reshape(-1, 3)
    rmax = rad.max()
    side = np.abs(ny) < 0.99
    U = np.where(np.repeat(side, seg + 1), np.repeat(ys, seg + 1) / WU,
                 (P[:, 0] - cx) / WU * 0.6)
    V = np.where(np.repeat(side, seg + 1), np.tile(ang - ang[0], len(profile)) * rmax / WV,
                 (P[:, 2] - cz) / WV * 0.6)
    UV = np.stack([U, V], 1) + off
    F = grid_faces(len(profile), seg + 1)
    keep = np.linalg.norm(np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]), axis=1) > 1e-12
    F = F[keep]
    return P, orient(P, F, N), N, UV

def post_profile(r, y0, y1, bev=0.004, n=8, top_round=0.0):
    """Coluna cilíndrica com a borda de baixo arredondada (e opcionalmente a de cima)."""
    pr = [(0.0, y0, (0, -1)), (r - bev, y0, (0, -1))]
    for a in np.linspace(-math.pi / 2, 0, n):
        pr.append((r - bev + bev * math.cos(a), y0 + bev + bev * math.sin(a), (math.cos(a), math.sin(a))))
    k = max(2, int((y1 - y0) / 0.02))
    for y in np.linspace(y0 + bev, y1 - max(top_round, 1e-4), k)[1:]:
        pr.append((r, y, (1, 0)))
    if top_round:
        for a in np.linspace(0, math.pi / 2, n):
            pr.append((r - top_round + top_round * math.cos(a), y1 - top_round + top_round * math.sin(a), (math.cos(a), math.sin(a))))
        pr.append((0.0, y1, (0, 1)))
    else:
        pr += [(r, y1, (0, 1)), (0.0, y1, (0, 1))]
    return pr

def extrude(outline, y0, y1, bev, grain, seed=None):
    """Prisma de planta convexa (pontos XZ em ordem) com arestas boleadas. outline: [(x, z, normal, miter)]."""
    r_ = np.random.default_rng(seed if seed is not None else int(rng.integers(1 << 30)))
    off = r_.uniform(0, 4, 2)
    pts = np.array([o[0:2] for o in outline]); nrm = np.array([o[2] for o in outline]); mit = np.array([o[3] for o in outline])
    pts = np.vstack([pts, pts[:1]]); nrm = np.vstack([nrm, nrm[:1]]); mit = np.vstack([mit, mit[:1]])
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    rings = []
    bs = 5
    for th in np.linspace(-math.pi / 2, 0, bs + 1):
        rings.append((-bev + bev * math.cos(th), y0 + bev + bev * math.sin(th), math.cos(th), math.sin(th)))
    for th in np.linspace(0, math.pi / 2, bs + 1):
        rings.append((-bev + bev * math.cos(th), y1 - bev + bev * math.sin(th), math.cos(th), math.sin(th)))
    P, N, UV = [], [], []
    for (ho, y, cn, sn) in rings:
        xz = pts + mit * ho
        P.append(np.stack([xz[:, 0], np.full(len(xz), y), xz[:, 1]], 1))
        N.append(np.stack([nrm[:, 0] * cn, np.full(len(xz), sn), nrm[:, 1] * cn], 1))
        UV.append(np.stack([arc / WU, np.full(len(xz), y / WV)], 1) + off)
    P, N, UV = np.vstack(P), np.vstack(N), np.vstack(UV)
    F = grid_faces(len(rings), len(pts))
    keep = np.linalg.norm(np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]), axis=1) > 1e-14
    yield P, orient(P, F[keep], N), N, UV
    # tampas de cima e de baixo (leque a partir do centro)
    inner = pts[:-1] - mit[:-1] * bev
    cen = inner.mean(0)
    o = 2 - grain if grain != 1 else 2
    for y, ny in ((y0, -1), (y1, 1)):
        Pc = np.vstack([[cen[0], y, cen[1]], np.stack([inner[:, 0], np.full(len(inner), y), inner[:, 1]], 1)])
        Nc = np.tile([0, ny, 0], (len(Pc), 1))
        UVc = np.stack([Pc[:, grain] / WU, Pc[:, o] / WV], 1) + off
        m = len(inner)
        Fc = np.array([[0, 1 + i, 1 + (i + 1) % m] for i in range(m)])
        yield Pc, orient(Pc, Fc, Nc), Nc, UVc

def seg_edge(p0, p1, n, step=0.03):
    """Pontos de um lado reto (sem o último), todos com a mesma normal."""
    k = max(1, int(np.linalg.norm(np.subtract(p1, p0)) / step))
    return [(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, n, n) for t in np.linspace(0, 1, k + 1)[:-1]]

def corner(p, n_in, n_out):
    m = np.add(n_in, n_out); m = m / np.dot(m, n_in)
    return [(p[0], p[1], n_in, tuple(m)), (p[0], p[1], n_out, tuple(m))]

def arc_pts(c, r, a0, a1, n=12):
    out = []
    for a in np.linspace(a0, a1, n + 1)[:-1]:
        d = (math.cos(a), math.sin(a))
        out.append((c[0] + r * d[0], c[1] + r * d[1], d, d))
    return out

# ---------------------------------------------------------------- estrutura de madeira
def build_frame():
    # pés da frente
    for sx in (-1, 1):
        add('Pe_Frente', 'wood', *lathe(post_profile(R, 0.0, TOPO - CAP_T), sx * XC, ZP))
        # colunas da cabeceira (sobem até a travessa de cima)
        add('Coluna_Cabeceira', 'wood', *lathe(post_profile(R, 0.0, SPINDLE_Y1 + 0.002), sx * XC, ZH))
    # aba da peseira: largura total, quinas externas arredondadas concêntricas aos pés
    z0, z1 = L / 2 - CAP_W, L / 2
    ol = []
    # planta em XZ (a = ângulo no plano x-z); contorno no sentido anti-horário visto de cima
    ol += corner((-W / 2, z0), (-1, 0), (0, -1))
    ol += seg_edge((-W / 2, z0), (W / 2, z0), (0, -1))[1:]
    ol += corner((W / 2, z0), (0, -1), (1, 0))
    ol += seg_edge((W / 2, z0), (W / 2, ZP), (1, 0))[1:]
    ol += arc_pts((XC, ZP), R, 0, math.pi / 2)
    ol += seg_edge((XC, z1), (-XC, z1), (0, 1))
    ol += arc_pts((-XC, ZP), R, math.pi / 2, math.pi)
    ol += seg_edge((-W / 2, ZP), (-W / 2, z0), (-1, 0))
    for g in extrude(ol, TOPO - CAP_T, TOPO, 0.0035, 0):
        add('Aba_Peseira', 'wood', *g)
    # abas laterais: da coluna da cabeceira até a aba da peseira (emenda de topo, como na foto)
    for sx in (-1, 1):
        xa, xb = sorted((sx * W / 2, sx * (W / 2 - CAP_W)))
        za, zb = ZH, z0 - 0.0008
        ol = []
        ol += corner((xa, za), (-1, 0), (0, -1)); ol += seg_edge((xa, za), (xb, za), (0, -1))[1:]
        ol += corner((xb, za), (0, -1), (1, 0)); ol += seg_edge((xb, za), (xb, zb), (1, 0))[1:]
        ol += corner((xb, zb), (1, 0), (0, 1)); ol += seg_edge((xb, zb), (xa, zb), (0, 1))[1:]
        ol += corner((xa, zb), (0, 1), (-1, 0)); ol += seg_edge((xa, zb), (xa, za), (-1, 0))[1:]
        for g in extrude(ol, TOPO - CAP_T, TOPO, 0.0035, 2):
            add('Aba_Lateral', 'wood', *g)
    # painéis das laterais e da peseira (sob as abas)
    rh = TOPO - CAP_T - RAIL_Y0
    ry = RAIL_Y0 + rh / 2 - 0.001
    for sx in (-1, 1):
        add_box('Lateral', 'wood', (RAIL_T, rh, ZP - ZH), 0.002, (sx * (W / 2 - RAIL_IN - RAIL_T / 2), ry, (ZP + ZH) / 2), 2)
    add_box('Peseira', 'wood', (2 * XC, rh, RAIL_T), 0.002, (0, ry, L / 2 - RAIL_IN - RAIL_T / 2), 0)
    # cabeceira: painel inferior (atrás do colchão), palitos e travessa de cima com pontas arredondadas
    add_box('Cabeceira_Painel', 'wood', (2 * XC, SPINDLE_Y0 - RAIL_Y0, 0.024), 0.003,
            (0, (SPINDLE_Y0 + RAIL_Y0) / 2, ZH), 0)
    xs = np.linspace(-XC, XC, N_SPINDLES + 2)[1:-1]
    for x in xs:
        add('Palito', 'wood', *lathe(post_profile(0.0085, SPINDLE_Y0 - 0.004, SPINDLE_Y1 + 0.004, bev=0.0005, n=2), x, ZH, seg=20))
    TR = R
    ol = []
    ol += arc_pts((XC, ZH), TR, -math.pi / 2, math.pi / 2, 16)
    ol += seg_edge((XC, ZH + TR), (-XC, ZH + TR), (0, 1), 0.05)
    ol += arc_pts((-XC, ZH), TR, math.pi / 2, 3 * math.pi / 2, 16)
    ol += seg_edge((-XC, ZH - TR), (XC, ZH - TR), (0, -1), 0.05)
    for g in extrude(ol, SPINDLE_Y1, H, 0.006, 0):
        add('Travessa_Cabeceira', 'wood', *g)
    # estrado: travessas de apoio, viga central com pés e ripas
    x_in = W / 2 - RAIL_IN - RAIL_T
    for sx in (-1, 1):
        add_box('Sarrafo_Apoio', 'wood', (0.022, 0.034, ZP - ZH - 2 * R), 0.002,
                (sx * (x_in - 0.011), SLAT_TOP - 0.018 - 0.017, (ZP + ZH) / 2), 2)
    add_box('Viga_Central', 'wood', (0.045, 0.07, ZP - ZH - 0.05), 0.002, (0, SLAT_TOP - 0.018 - 0.035, (ZP + ZH) / 2), 2)
    for z in (-0.45, 0.45):
        add_box('Pe_Central', 'wood', (0.05, SLAT_TOP - 0.018 - 0.07, 0.05), 0.003, (0, (SLAT_TOP - 0.088) / 2, z), 1)
    nsl = 15
    zs = np.linspace(ZH + 0.05, ZP - 0.06, nsl)
    for z in zs:
        add_box('Ripa', 'wood', (2 * x_in - 0.006, 0.018, 0.075), 0.002, (0, SLAT_TOP - 0.009, z), 0, step=0.05)

# ---------------------------------------------------------------- tecidos
def drape_surface(xr, zr, nx, nz, a, z0, z1, top, rc, hang, flare=0.0, flare_d=0.2, floor=None,
                  fold_amp=0.0, fold_len=0.12, sides=(True, True, False, True), seed=0):
    """Tecido estendido sobre um retângulo (|x|<=a, z0<=z<=z1, topo em y=top) e caindo pelas bordas.
    O comprimento do tecido é preservado: o que sobra além da borda contorna a quina de raio rc e desce."""
    r_ = np.random.default_rng(seed)
    X, Z = np.meshgrid(np.linspace(*xr, nx), np.linspace(*zr, nz), indexing='ij')
    qx = np.clip(X, -a, a); qz = np.clip(Z, z0, z1)
    ex, ez = X - qx, Z - qz
    both = (np.abs(ex) > 0) & (np.abs(ez) > 0)
    el = np.hypot(ex, ez)
    sc = np.where(both, np.maximum(np.abs(ex), np.abs(ez)) / np.maximum(el, 1e-9), 1.0)
    ex, ez = ex * sc, ez * sc
    d = np.hypot(ex, ez)
    dx, dz = ex / np.maximum(d, 1e-9), ez / np.maximum(d, 1e-9)
    al = math.pi / 2 * rc
    th = np.clip(d / rc, 0, math.pi / 2)
    drop = np.maximum(d - al, 0)
    hor = rc * np.sin(th) + flare * smoothstep(0, flare_d, drop)
    y = top - rc + rc * np.cos(th) - drop
    if floor is not None:
        extra = np.maximum(floor - y, 0)
        y = np.maximum(y, floor)
        hor = hor + extra
    # dobras verticais na parte pendurada, ao longo da borda
    s = np.where(np.abs(dx) > np.abs(dz), Z, X)
    ph = r_.uniform(0, 6.28, 3)
    wav = (np.sin(s / fold_len * 6.28 + ph[0]) * 0.6 + np.sin(s / fold_len * 2.7 + ph[1]) * 0.4
           + 0.3 * np.sin(s / fold_len * 11.3 + ph[2]))
    amp = fold_amp * smoothstep(0.0, 0.25, drop) * (0.6 + 0.4 * np.sin(s * 3.1 + ph[2]))
    hor = hor + amp * wav
    P = np.stack([qx + dx * hor, y, qz + dz * hor], -1)
    return P, X, Z

def wrinkle(P, X, Z, amp, n_creases, crease_amp, seed, mask=None):
    """Amassados do tecido: ondulação suave + vincos finos e compridos, deslocando ao longo da normal."""
    r_ = np.random.default_rng(seed)
    nx, nz = X.shape
    N = vertex_normals(P.reshape(-1, 3), grid_faces(nx, nz)).reshape(nx, nz, 3)
    if N[..., 1].mean() < 0:
        N = -N
    disp = amp * (fbm((nx, nz), 5, seed, 3, tile=False) - 0.5) * 2
    for _ in range(n_creases):
        cx, cz = r_.uniform(X.min(), X.max()), r_.uniform(Z.min(), Z.max())
        th = r_.uniform(0, math.pi)
        dx, dz = math.cos(th), math.sin(th)
        along = (X - cx) * dx + (Z - cz) * dz
        across = -(X - cx) * dz + (Z - cz) * dx
        Lc, wc = r_.uniform(0.08, 0.35), r_.uniform(0.006, 0.016)
        bend = r_.uniform(-0.6, 0.6) * along ** 2
        disp += r_.choice([-1, 1]) * crease_amp * r_.uniform(0.4, 1) * np.exp(-((across - bend) / wc) ** 2)             * np.exp(-(along / Lc) ** 2)
    if mask is not None:
        disp = disp * mask
    return P + N * disp[..., None]

def slab(P, X, Z, t, name, mat, uvs, extra_disp=None):
    """Transforma uma superfície em grade (topo) numa peça com espessura t, bordas fechadas."""
    nx, nz = X.shape
    Pt = P.reshape(-1, 3)
    F = grid_faces(nx, nz)
    N = vertex_normals(Pt, F)
    if N[:, 1].mean() < 0:
        N = -N
    F = orient(Pt, F, N)
    UV = np.stack([X.reshape(-1), Z.reshape(-1)], 1) * uvs
    add(name, mat, Pt, F, N, UV)
    Pb = Pt - N * t
    add(name, mat, Pb, orient(Pb, F, -N), -N, UV)
    # bainha: liga a borda de cima à de baixo
    idx = np.arange(nx * nz).reshape(nx, nz)
    loops = [(idx[:, 0], idx[:, 1]), (idx[-1, :], idx[-2, :]), (idx[::-1, -1], idx[::-1, -2]), (idx[0, ::-1], idx[1, ::-1])]
    for b, inn in loops:
        Pa, Pz = Pt[b], Pb[b]
        tvec = Pa - Pt[inn]
        tvec = normalize(tvec - (tvec * N[b]).sum(1, keepdims=True) * N[b])
        ang = np.linspace(-math.pi / 2, math.pi / 2, 7)
        mid = (Pa + Pz) / 2
        Ph = np.vstack([mid + N[b] * (t / 2) * math.sin(q) + tvec * t * 0.5 * math.cos(q) for q in ang[::-1]])
        Nh = np.vstack([normalize(N[b] * math.sin(q) + tvec * math.cos(q)) for q in ang[::-1]])
        UVh = np.vstack([UV[b] + (k - 3) * t * 0.5 * uvs for k in range(7)])
        Fh = grid_faces(7, len(b))
        add(name, mat, Ph, orient(Ph, Fh, Nh), Nh, UVh)

def pillow(Wp, Hp, T, seed, nu=72, nv=56, sag=0.0):
    """Travesseiro: duas faces estufadas costuradas na borda, cantos em 'orelha'. Local: largura X, altura Z, espessura Y."""
    r_ = np.random.default_rng(seed)
    u = np.linspace(-1, 1, nu); v = np.linspace(-1, 1, nv)
    U, V = np.meshgrid(u, v, indexing='ij')
    pinch_x = 1 - 0.06 * (1 - V ** 2)
    pinch_z = 1 - 0.07 * (1 - U ** 2)
    X = U * Wp / 2 * pinch_x
    Z = V * Hp / 2 * pinch_z
    prof = np.clip(1 - np.abs(U) ** 2.4, 0, 1) ** 0.45 * np.clip(1 - np.abs(V) ** 2.4, 0, 1) ** 0.45
    wr = fbm((64, 64), 4, seed, 3)
    wr = np.asarray(Image.fromarray((wr * 255).astype(np.uint8)).resize((nv, nu), Image.BICUBIC), float) / 255 - 0.5
    creases = np.zeros_like(U)
    for _ in range(9):           # vincos que partem dos cantos e da borda, como num travesseiro usado
        cu, cv = r_.choice([-1, 1]) * r_.uniform(0.5, 1), r_.choice([-1, 1]) * r_.uniform(0.3, 1)
        th = math.atan2(-cv, -cu) + r_.uniform(-0.5, 0.5)
        al = (U - cu) * math.cos(th) + (V - cv) * math.sin(th)
        ac = -(U - cu) * math.sin(th) + (V - cv) * math.cos(th)
        creases -= np.exp(-(ac / r_.uniform(0.03, 0.06)) ** 2) * np.exp(-(np.clip(al, 0, None) / r_.uniform(0.3, 0.7)) ** 2) * (al > -0.05)
    out = []
    for sgn in (1, -1):
        Y = sgn * (T / 2 * prof * (1 + 0.3 * wr * sgn) + 0.006 * creases * prof ** 0.5) - sag * (1 - U ** 2) * (1 - V ** 2)
        P = np.stack([X, Y, Z], -1).reshape(-1, 3)
        F = grid_faces(nu, nv)
        N = vertex_normals(P, F)
        guide = np.stack([U.reshape(-1) * 0.3, np.full(nu * nv, sgn), V.reshape(-1) * 0.3], 1)
        if (N * guide).sum() < 0:
            N = -N
        F = orient(P, F, N)
        UV = np.stack([X.reshape(-1), Z.reshape(-1)], 1)
        out.append((P, F, N, UV))
    return out

def place_pillow(name, mat, parts, R_, t, uvs):
    for P, F, N, UV in parts:
        add(name, mat, P @ R_.T + t, F, N @ R_.T, UV * uvs)

def build_bedding():
    mw, mh, ml = MATT
    mz0, mz1 = ZH + 0.012, L / 2 - CAP_W - 0.004
    mzc = (mz0 + mz1) / 2
    add_box('Colchao', 'mattress', (mw, mh, mz1 - mz0), 0.045, (0, SLAT_TOP + mh / 2, mzc), 0, uv='fabric', step=0.03)
    mtop = SLAT_TOP + mh
    # edredom listrado: cobre do meio para os pés e cai pelos lados e pela frente
    dt = 0.035
    a = mw / 2 - 0.005
    hang = mtop + dt - 0.43
    rc = 0.05
    D = hang + rc * (math.pi / 2 - 1)
    zt0 = ZH + 0.55
    P, X, Z = drape_surface((-a - D, a + D), (zt0, mz1 + D), 190, 175, a, zt0 - 1, mz1, mtop + dt, rc, hang,
                            fold_amp=0.008, fold_len=0.16, seed=5)
    P = wrinkle(P, X, Z, 0.006, 70, 0.005, 6)
    slab(P, X, Z, dt, 'Edredom', 'duvet', 1.0)
    # dobra virada do edredom na cabeceira
    fz = zt0
    for k in range(1):
        P2, X2, Z2 = drape_surface((-a - 0.02, a + 0.02), (fz, fz + 0.14), 120, 14, a, fz - 1, fz + 1, mtop + 2 * dt + 0.004, rc, 0)
        P2[..., 2] += 0.004 * np.sin(P2[..., 0] * 9)
        P2 = wrinkle(P2, X2, Z2, 0.004, 12, 0.004, 7)
        slab(P2, X2, Z2, dt * 0.8, 'Edredom_Dobra', 'duvet', 1.0)
    # travesseiros grandes encostados na cabeceira e almofadas listradas na frente
    base_y = mtop + 0.005
    for i, sx in enumerate((-1, 1)):
        parts = pillow(0.72, 0.50, 0.21, 40 + i)
        R_ = rot_axis(np.array([1, 0, 0.]), math.radians(38)) @ rot_axis(np.array([0, 0, 1.]), sx * math.radians(1.5))
        place_pillow('Travesseiro', 'pillow', parts, R_, np.array([sx * 0.385, base_y + 0.20, ZH + 0.29]), 1.0)
    for i, sx in enumerate((-1, 1)):
        parts = pillow(0.62, 0.40, 0.17, 50 + i)
        R_ = rot_axis(np.array([1, 0, 0.]), math.radians(30)) @ rot_axis(np.array([0, 0, 1.]), sx * math.radians(2))
        place_pillow('Almofada', 'pillow_striped', parts, R_, np.array([sx * 0.34, base_y + 0.15, ZH + 0.47]), 1.0)
    # manta de tricô waffle verde atravessada nos pés, caindo até o tapete dos dois lados
    tt = 0.012
    ta = a + 0.012
    ttop = mtop + dt + tt + 0.002
    tz0, tz1 = 0.22, 0.86
    thang = ttop - 0.0
    D = thang + 0.10 + 0.06 * (math.pi / 2 - 1)
    P, X, Z = drape_surface((-ta - D, ta + D), (tz0, tz1), 260, 70, ta, tz0 - 0.5, tz1 + 0.5, ttop, 0.06, thang,
                            flare=0.075, flare_d=0.22, floor=0.006, fold_amp=0.018, fold_len=0.14, seed=9)
    # a manta é amassada em cima também
    P = wrinkle(P, X, Z, 0.006, 30, 0.006, 12, mask=smoothstep(ttop - 0.08, ttop - 0.01, P[..., 1]))
    slab(P, X, Z, tt, 'Manta', 'throw', 1.0)
    # franjas torcidas nas pontas
    for side in (0, -1):
        hem = P[side, :, :]
        out_dir = np.sign(hem[:, 0].mean())
        for j in range(1, len(hem) - 1, 3):
            p0 = hem[j] + np.array([0, -tt / 2, 0])
            Lf = rng.uniform(0.07, 0.10)
            pts = []
            for k in range(9):
                t_ = k / 8
                pts.append(p0 + np.array([out_dir * (t_ * Lf * 0.85 + rng.uniform(-0.004, 0.004)),
                                          0, rng.uniform(-0.006, 0.006) * t_]))
            pts = np.array(pts)
            pts[:, 1] = np.maximum(0.0025, pts[:, 1])
            fringe_tube(pts, 0.0022)

def fringe_tube(path, r, sides=6):
    from ficus2 import tube
    P, F, N, UV, _ = tube(path, np.full(len(path), r) * np.linspace(1, 0.7, len(path)), sides=sides, v_scale=30)
    add('Franja', 'throw', P, F, N, UV * 0.05)

# ---------------------------------------------------------------- texturas
import io
from pathlib import Path

AQUI = Path(__file__).resolve().parent

def jpg_file(path):
    return path.read_bytes(), 'image/jpeg'

def wood_maps():
    """Mesma madeira da Mesinha Redonda (texturas extraídas do .glb dela), com o verniz mais fosco."""
    d = AQUI / 'tex_mesinha'
    orm = np.asarray(Image.open(d / 'estrutura_orm.jpg').convert('RGB'), float)
    orm[..., 1] = np.clip(orm[..., 1] * 1.45, 0, 255)          # rugosidade ~0,6: acabamento fosco
    return jpg_file(d / 'estrutura_cor.jpg'), jpg_file(d / 'estrutura_normal.jpg'), jpg(orm, 90)

def fabric_maps(asset, S=1024, contrast=1.3, stripes=None):
    """Tecido fotografado (Poly Haven, CC0) em tom neutro claro, para a cor vir do material (combinações de cor).
    stripes: (listras por ladrilho, quanto escurece, largura relativa) tecidas na própria trama."""
    d = AQUI / 'tex_polyhaven' / asset
    def load(n, mode):
        return np.asarray(Image.open(d / f'{n}_2k.jpg').convert(mode).resize((S, S), Image.LANCZOS), float)
    lum = load('diff', 'L')
    v = 1 + (lum / lum.mean() - 1) * contrast
    if stripes is not None:
        n_st, dark, width = stripes
        y = (np.arange(S)[:, None] + 0.5) / S
        tri = np.abs(((y * n_st) % 1) - 0.5) * 2                 # 0 no centro da listra
        st = smoothstep(width, width * 0.6, tri)
        v = v * (1 - dark * st * (0.85 + 0.3 * (lum / lum.mean() - 1) * 4).clip(0.6, 1.2))
    col = np.clip(248 * v, 0, 255)
    col = np.dstack([col, col, col])
    return jpg(col, 88), jpg(load('nor_gl', 'RGB'), 88), jpg(load('arm', 'RGB'), 88)

# combinações de roupa de cama: cor de cada material (a textura é neutra clara)
COMBOS = {
    'Branco e Verde': {'Edredom': '#ecebe6', 'Manta': '#7f8c62', 'Travesseiro': '#ece8df', 'Almofada': '#e6e4dc'},
    'Cinza e Rosa': {'Edredom': '#b4b4b1', 'Manta': '#cf9a94', 'Travesseiro': '#e9e6e1', 'Almofada': '#ddb5ae'},
    'Areia e Terracota': {'Edredom': '#dccfb9', 'Manta': '#ad5f3d', 'Travesseiro': '#efe8db', 'Almofada': '#cfa385'},
}

def hex_lin(h):
    return [float(x) for x in srgb_to_lin([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])]

def main():
    t0 = time.time()
    build_frame()
    if DECORADA:
        build_bedding()
    Pa = np.vstack([p[2] for p in PARTS])
    lo, hi = Pa.min(0), Pa.max(0)
    off = np.array([-(lo[0] + hi[0]) / 2, 0, -(lo[2] + hi[2]) / 2])
    wood = np.vstack([p[2] for p in PARTS if p[1] == 'wood'])
    print('medidas da cama (m)', (wood.max(0) - wood.min(0)).round(3), 'total', (hi - lo).round(3))
    Ns = np.vstack([p[4] for p in PARTS])
    Fs, b = [], 0
    for p in PARTS:
        Fs.append(p[3] + b); b += len(p[2])
    Fa = np.vstack(Fs)
    ao = bake_ao(Pa + off, Ns, Fa)
    print('AO %.1fs, %d vértices, %d triângulos' % (time.time() - t0, len(Pa), len(Fa)))
    meshes, k = {}, 0
    for (name, mat, P, F, N, UV) in PARTS:
        n = len(P)
        a = ao[k:k + n]; k += n
        shade = np.clip(0.42 + 0.58 * a, 0, 1) if mat == 'wood' else np.clip(0.5 + 0.5 * a, 0, 1)
        meshes.setdefault(mat, Mesh()).add(P + off, F, N=N, UV=UV, C=np.repeat(shade[:, None], 3, 1), fix=False)
    g = GLB()
    g.j['asset']['generator'] = 'lp-imoveis cama-queen gen'
    g.j['nodes'][0]['name'] = 'CamaQueenMadeira'
    used = []
    tw = [g.image(x) for x in wood_maps()]
    # tom nogueira das fotos sobre a madeira natural da mesinha
    m_w = g.material(dict(name='Madeira', pbrMetallicRoughness=dict(
        baseColorFactor=[0.40, 0.46, 0.78, 1], baseColorTexture=dict(index=tw[0]), metallicFactor=0.0, roughnessFactor=1.0,
        metallicRoughnessTexture=dict(index=tw[2])), normalTexture=dict(index=tw[1], scale=0.6),
        occlusionTexture=dict(index=tw[2], strength=0.7)))
    print('Estrutura', g.mesh('Estrutura', meshes['wood'], m_w))
    if DECORADA:
        used.append('KHR_materials_sheen')
        combo = COMBOS['Branco e Verde']
        def fab(name, maps, color, nscale=1.0, sheen=0.35):
            t = [g.image(x) for x in maps]
            return g.material(dict(name=name, doubleSided=True, pbrMetallicRoughness=dict(
                baseColorFactor=hex_lin(color) + [1], baseColorTexture=dict(index=t[0]), metallicFactor=0.0,
                roughnessFactor=1.0, metallicRoughnessTexture=dict(index=t[2])),
                normalTexture=dict(index=t[1], scale=nscale), occlusionTexture=dict(index=t[2], strength=1.0),
                extensions=dict(KHR_materials_sheen=dict(sheenColorFactor=[sheen] * 3, sheenRoughnessFactor=0.55))))
        # (material, escala de UV = 1 / tamanho do ladrilho em metros)
        mats = {
            'mattress': (fab('Colchao', fabric_maps('terlenka', 1024), '#f2f1ee'), 1 / 0.27),
            'duvet': (fab('Edredom', fabric_maps('cotton_jersey', 1024, 1.4, stripes=(18, 0.11, 0.22)), combo['Edredom']), 1 / 0.30),
            'pillow': (fab('Travesseiro', fabric_maps('rough_linen', 1024, 1.2), combo['Travesseiro']), 1 / 0.27),
            'pillow_striped': (fab('Almofada', fabric_maps('terlenka', 1024, 1.3, stripes=(16, 0.10, 0.3)), combo['Almofada']), 1 / 0.27),
            'throw': (fab('Manta', fabric_maps('waffle_pique_cotton', 1024, 1.0), combo['Manta'], nscale=1.4, sheen=0.25), 1 / 0.40),
        }
        names = dict(mattress='Colchao', duvet='Edredom', pillow='Travesseiros', pillow_striped='Almofadas', throw='Manta')
        for key, (mi, uvs) in mats.items():
            m = meshes[key]
            m.UV = [u * uvs for u in m.UV]
            print(names[key], g.mesh(names[key], m, mi))
    if used:
        g.j['extensionsUsed'] = used
    g.save(OUT)
    print('ok %.1fs' % (time.time() - t0), OUT)

main()
