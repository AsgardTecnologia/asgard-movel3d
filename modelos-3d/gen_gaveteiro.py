"""Gera gaveteiro 4 gavetas preto fosco (.glb). Unidades em metros, Y para cima, frente em +Z."""
import json, math, random, struct, sys, zlib

OUT = sys.argv[1]

# ---------------- geometria ----------------
def rounded_box(size, r, center=(0, 0, 0), seg=3, uv_scale=10.0):
    h = [s / 2 for s in size]
    r = min(r, min(h) * 0.95)
    angs = [math.atan(1) * k / seg for k in range(seg + 1)]
    def coords(hh):
        inner = hh - r
        neg = [-(inner + r * math.tan(a)) for a in reversed(angs)]
        pos = [inner + r * math.tan(a) for a in angs]
        if inner < 1e-9:
            pos = pos[1:]
        return neg + pos
    C = [coords(x) for x in h]
    P, N, UV, I = [], [], [], []
    for n in range(3):
        u, v = [a for a in range(3) if a != n]
        for sgn in (-1, 1):
            base = len(P)
            cu, cv = C[u], C[v]
            for a in cu:
                for b in cv:
                    p = [0, 0, 0]
                    p[n], p[u], p[v] = sgn * h[n], a, b
                    inner = [max(-(h[k] - r), min(h[k] - r, p[k])) for k in range(3)]
                    d = [p[k] - inner[k] for k in range(3)]
                    L = math.sqrt(sum(x * x for x in d)) or 1.0
                    nn = [x / L for x in d]
                    q = [inner[k] + nn[k] * r + center[k] for k in range(3)]
                    P.append(q); N.append(nn)
                    UV.append((a * uv_scale, b * uv_scale))
            nv = len(cv)
            for i in range(len(cu) - 1):
                for j in range(nv - 1):
                    a0 = base + i * nv + j
                    a1, a2, a3 = a0 + nv, a0 + nv + 1, a0 + 1
                    # orientação: normal da face deve apontar para fora
                    flip = (sgn > 0) != ((u, v) in ((1, 2), (2, 0), (0, 1)))
                    if not flip:
                        I += [a0, a1, a2, a0, a2, a3]
                    else:
                        I += [a0, a2, a1, a0, a3, a2]
    return P, N, UV, I


class Mesh:
    def __init__(self):
        self.prims = {}  # material -> [P,N,UV,I]
    def add(self, mat, box):
        P, N, UV, I = box
        d = self.prims.setdefault(mat, [[], [], [], []])
        off = len(d[0])
        d[0] += P; d[1] += N; d[2] += UV; d[3] += [i + off for i in I]
        return self


# ---------------- medidas ----------------
W, D, H = 0.415, 0.415, 0.640
TOP_T = 0.025
INSET = 0.003                       # tampo sobressai 3 mm
CW = W - 2 * INSET                  # largura do corpo 0.409
SIDE_T = 0.016
ZF = D / 2 - INSET                  # face frontal do corpo
ZB = -D / 2 + INSET
INNER_X = CW / 2 - SIDE_T           # face interna da lateral
BODY_H = H - TOP_T                  # 0.615
BASE_H = 0.012
GAP = 0.003
FRONT_T = 0.018
FRONT_W = 2 * INNER_X - 2 * 0.002
FRONT_H = (BODY_H - GAP - BASE_H - 3 * GAP) / 4
OPEN_IDX, OPEN_Z = 1, 0.26          # 2ª gaveta (de cima) aberta 26 cm

BOX_SIDE = 0.012
BOX_W = 2 * (INNER_X - 0.013)
BOX_D = 0.360
BOX_H = FRONT_H - 0.035
BOX_ZF = ZF - FRONT_T
SLIDE_L = 0.350

PRETO, INTERNO, ALU, ACO = "preto_fosco", "preto_interno", "aluminio_escovado", "aco_zincado"

nodes, meshes = [], []
def add_node(name, mesh=None, t=(0, 0, 0), children=None):
    n = {"name": name}
    if mesh is not None:
        meshes.append(mesh); n["mesh"] = len(meshes) - 1
    if any(t):
        n["translation"] = list(t)
    if children:
        n["children"] = children
    nodes.append(n)
    return len(nodes) - 1

# corpo
corpo = []
corpo.append(add_node("Tampo", Mesh().add(PRETO, rounded_box((W, TOP_T, D), 0.0025, (0, H - TOP_T / 2, 0)))))
for s, nm in ((-1, "Lateral_Esquerda"), (1, "Lateral_Direita")):
    corpo.append(add_node(nm, Mesh().add(PRETO, rounded_box((SIDE_T, BODY_H, ZF - ZB), 0.0015,
                                                          (s * (CW / 2 - SIDE_T / 2), BODY_H / 2, (ZF + ZB) / 2)))))
corpo.append(add_node("Fundo_Traseiro", Mesh().add(PRETO, rounded_box((2 * INNER_X, BODY_H - 0.002, 0.008), 0.001,
                                                                    (0, BODY_H / 2, ZB + 0.004)))))
corpo.append(add_node("Base", Mesh()
                      .add(PRETO, rounded_box((2 * INNER_X, 0.016, ZF - ZB - 0.03), 0.001, (0, BASE_H + 0.004, (ZF + ZB) / 2 - 0.01)))
                      .add(PRETO, rounded_box((2 * INNER_X, BASE_H, 0.016), 0.001, (0, BASE_H / 2, ZF - 0.02)))))

def front_center_y(i):
    top = BODY_H - GAP - i * (FRONT_H + GAP)
    return top - FRONT_H / 2

def handle_mesh():
    m = Mesh()
    L, spacing, stand = 0.150, 0.128, 0.026
    m.add(ALU, rounded_box((L, 0.011, 0.009), 0.0022, (0, 0, ZF + stand + 0.0045), seg=3))
    for s in (-1, 1):
        m.add(ALU, rounded_box((0.010, 0.011, stand + 0.002), 0.0018, (s * spacing / 2, 0, ZF + stand / 2 - 0.001), seg=3))
    return m

# corrediças fixas no corpo + intermediárias
rail_y_rel = -FRONT_H / 2 + 0.012 + 0.006 + BOX_H / 2 - 0.01
for i in range(4):
    cy = front_center_y(i) + rail_y_rel
    zc = ZF - 0.02 - SLIDE_L / 2
    m = Mesh()
    for s in (-1, 1):
        x0 = s * INNER_X
        m.add(ACO, rounded_box((0.0012, 0.036, SLIDE_L), 0.0004, (x0 - s * 0.0006, cy, zc)))
        for dy in (-1, 1):
            m.add(ACO, rounded_box((0.006, 0.0012, SLIDE_L), 0.0004, (x0 - s * 0.003, cy + dy * 0.0174, zc)))
    corpo.append(add_node(f"Corredica_Fixa_{i+1}", m))
    mid = Mesh()
    for s in (-1, 1):
        x0 = s * INNER_X
        mid.add(ACO, rounded_box((0.0012, 0.030, SLIDE_L - 0.01), 0.0004, (x0 - s * 0.0055, cy, zc)))
        for dy in (-1, 1):
            mid.add(ACO, rounded_box((0.004, 0.0012, SLIDE_L - 0.01), 0.0004, (x0 - s * 0.0075, cy + dy * 0.0144, zc)))
        # esferas (rolamentos) visíveis
        for k in range(6):
            mid.add(ACO, rounded_box((0.004, 0.004, 0.004), 0.0019, (x0 - s * 0.0045, cy + 0.0155, zc + SLIDE_L / 2 - 0.02 - k * 0.012), seg=2))
    corpo.append(add_node(f"Corredica_Intermediaria_{i+1}", mid, (0, 0, OPEN_Z / 2 if i == OPEN_IDX else 0)))

gavetas = []
for i in range(4):
    cy = front_center_y(i)
    frente = add_node(f"Frente_{i+1}", Mesh().add(PRETO, rounded_box((FRONT_W, FRONT_H, FRONT_T), 0.0015, (0, 0, ZF - FRONT_T / 2))))
    puxador = add_node(f"Puxador_{i+1}", handle_mesh(), (0, 0.012, 0))
    yb = -FRONT_H / 2 + 0.012          # fundo da caixa
    zc = BOX_ZF - BOX_D / 2
    cx = Mesh()
    for s in (-1, 1):
        cx.add(INTERNO, rounded_box((BOX_SIDE, BOX_H, BOX_D), 0.001, (s * (BOX_W / 2 - BOX_SIDE / 2), yb + BOX_H / 2, zc)))
        # trilho interno preso na gaveta
        cx.add(ACO, rounded_box((0.0012, 0.024, SLIDE_L - 0.02), 0.0004, (s * (INNER_X - 0.0105), yb + 0.006 + BOX_H / 2 - 0.01, BOX_ZF - 0.01 - (SLIDE_L - 0.02) / 2)))
    cx.add(INTERNO, rounded_box((BOX_W - 2 * BOX_SIDE, BOX_H, BOX_SIDE), 0.001, (0, yb + BOX_H / 2, BOX_ZF - BOX_D + BOX_SIDE / 2)))
    cx.add(INTERNO, rounded_box((BOX_W - 2 * BOX_SIDE, BOX_H, BOX_SIDE), 0.001, (0, yb + BOX_H / 2, BOX_ZF - BOX_SIDE / 2 - 0.0005)))
    cx.add(INTERNO, rounded_box((BOX_W - 2 * BOX_SIDE, 0.006, BOX_D - 2 * BOX_SIDE), 0.0008, (0, yb + 0.003 + 0.004, zc)))
    caixa = add_node(f"Caixa_{i+1}", cx)
    gavetas.append(add_node(f"Gaveta_{i+1}", None, (0, cy, OPEN_Z if i == OPEN_IDX else 0), [frente, puxador, caixa]))

g_corpo = add_node("Corpo", None, children=corpo)
root = add_node("Gaveteiro_4_Gavetas", None, children=[g_corpo] + gavetas)

# ---------------- textura normal (grão fino do MDP/melamina) ----------------
def make_normal_png(sz=256, seed=7):
    rnd = random.Random(seed)
    hgt = [[rnd.random() for _ in range(sz)] for _ in range(sz)]
    for _ in range(2):
        hgt = [[(hgt[y][x] + hgt[y][(x + 1) % sz] + hgt[y][x - 1] + hgt[(y + 1) % sz][x] + hgt[y - 1][x]) / 5
                for x in range(sz)] for y in range(sz)]
    rows = b""
    k = 6.0
    for y in range(sz):
        row = bytearray([0])
        for x in range(sz):
            dx = (hgt[y][(x + 1) % sz] - hgt[y][x - 1]) * k
            dy = (hgt[(y + 1) % sz][x] - hgt[y - 1][x]) * k
            l = math.sqrt(dx * dx + dy * dy + 1)
            row += bytes([int((-dx / l * 0.5 + 0.5) * 255), int((-dy / l * 0.5 + 0.5) * 255), int((1 / l * 0.5 + 0.5) * 255)])
        rows += bytes(row)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", sz, sz, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))

# ---------------- montagem glTF ----------------
buf = bytearray()
views, accessors = [], []
def push(data, target=None):
    while len(buf) % 4: buf.append(0)
    off = len(buf); buf.extend(data)
    v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
    if target: v["target"] = target
    views.append(v); return len(views) - 1
def acc(vals, comp, typ, ncomp, target, minmax=False):
    flat = [c for v in vals for c in (v if ncomp > 1 else (v,))]
    fmt = {5126: "f", 5125: "I"}[comp]
    a = {"bufferView": push(struct.pack("<%d%s" % (len(flat), fmt), *flat), target),
         "componentType": comp, "count": len(vals), "type": typ}
    if minmax:
        a["min"] = [min(v[k] for v in vals) for k in range(ncomp)]
        a["max"] = [max(v[k] for v in vals) for k in range(ncomp)]
    accessors.append(a); return len(accessors) - 1

mat_names = [PRETO, INTERNO, ALU, ACO]
materials = [
    {"name": PRETO, "pbrMetallicRoughness": {"baseColorFactor": [0.022, 0.022, 0.024, 1], "metallicFactor": 0.0, "roughnessFactor": 0.58}},
    {"name": INTERNO, "pbrMetallicRoughness": {"baseColorFactor": [0.02, 0.02, 0.022, 1], "metallicFactor": 0.0, "roughnessFactor": 0.75}},
    {"name": ALU, "pbrMetallicRoughness": {"baseColorFactor": [0.86, 0.86, 0.87, 1], "metallicFactor": 1.0, "roughnessFactor": 0.27}},
    {"name": ACO, "pbrMetallicRoughness": {"baseColorFactor": [0.72, 0.73, 0.75, 1], "metallicFactor": 1.0, "roughnessFactor": 0.33}},
]
gl_meshes = []
for idx, m in enumerate(meshes):
    prims = []
    for mat, (P, N, UV, I) in m.prims.items():
        prims.append({"attributes": {"POSITION": acc(P, 5126, "VEC3", 3, 34962, True),
                                     "NORMAL": acc(N, 5126, "VEC3", 3, 34962),
                                     "TEXCOORD_0": acc(UV, 5126, "VEC2", 2, 34962)},
                      "indices": acc(I, 5125, "SCALAR", 1, 34963), "material": mat_names.index(mat)})
    gl_meshes.append({"name": nodes[[n.get("mesh") for n in nodes].index(idx)]["name"], "primitives": prims})

gltf = {
    "asset": {"version": "2.0", "generator": "gen_gaveteiro.py"},
    "scene": 0, "scenes": [{"name": "Gaveteiro", "nodes": [root]}],
    "nodes": nodes, "meshes": gl_meshes, "materials": materials,
    "accessors": accessors, "bufferViews": views,
}
while len(buf) % 4: buf.append(0)
gltf["buffers"] = [{"byteLength": len(buf)}]
js = json.dumps(gltf, separators=(",", ":")).encode()
js += b" " * ((4 - len(js) % 4) % 4)
glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf))
glb += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(buf), 0x004E4942) + bytes(buf)
open(OUT, "wb").write(glb)
print("ok", OUT, len(glb), "bytes; frente h=%.4f" % FRONT_H)
