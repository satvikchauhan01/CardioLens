"""Build the 3D heart model from the BodyParts3D heart parts (BUILD_MAP T6.1, T6.2).

Run from the repository root with the backend's Python (it needs numpy and scipy only):

    backend\\.venv\\Scripts\\python.exe tools\\heart_model\\build_heart.py --source "<folder with the .obj files>"

It reads the OBJ files (one anatomical structure per file, named with its FMA id), keeps the parts
that can be seen from outside, puts them in the viewer's axes and scale, and writes

  1. frontend/public/models/heart.glb   the heart and the coronary arteries, one named object each
  2. frontend/src/scene/heartModelData.ts   artery centre lines and label anchors for the viewer

The source folder is not part of the repository. Nothing is read from the network; the last step
runs the glTF-Transform command-line tool through npx to weld, simplify and compress the model.
"""

import argparse
import json
import re
import shutil
import struct
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

REPO = Path(__file__).resolve().parents[2]
MODEL_OUT = REPO / "frontend" / "public" / "models" / "heart.glb"
DATA_OUT = REPO / "frontend" / "src" / "scene" / "heartModelData.ts"
GLTF_TRANSFORM = "@gltf-transform/cli@4.5.1"

# --- what goes into the model ------------------------------------------------------------------
# Every part is named by its FMA id and English name, exactly as in the source file names.

# The three vessels the models predict: only the trunk of each artery takes the risk colour.
# The object names are the target ids of the API (ARCHITECTURE §6, TC-3).
VESSELS = {
    "lad": [("FMA74912", "Trunk of anterior interventricular branch of left coronary artery")],
    "lcx": [("FMA74923", "Trunk of circumflex branch of left coronary artery")],
    "rca": [("FMA3802", "Trunk of right coronary artery")],
}
LEFT_MAIN = [("FMA4685", "Stem of left coronary artery")]
# Branches are drawn in a neutral colour: the dataset labels the three vessels, not their branches.
BRANCHES = [
    ("FMA3860", "Diagonal branch of anterior descending branch of left coronary artery"),
    ("FMA3888", "Second left anterior branch of anterior interventricular branch of left coronary artery"),
    ("FMA3890", "Third left anterior branch of anterior interventricular branch of left coronary artery"),
    ("FMA3902", "Left marginal artery"),
    ("FMA3914", "First posterior ventricular branch of circumflex coronary artery"),
    ("FMA79742", "Trunk of posterior interventricular branch of left coronary artery"),
    ("FMA3815", "First anterior ventricular branch of right coronary artery"),
    ("FMA3818", "Marginal branch of right coronary artery"),
    ("FMA3807", "Conus branch of right coronary artery"),
    ("FMA3823", "Sinoatrial nodal branch of right coronary artery"),
    ("FMA3837", "First posterior ventricular branch of right coronary artery"),
    ("FMA3829", "Anterior atrial branch of right coronary artery"),
]
# The outside of the heart: chamber walls, auricles and the roots of the great arteries.
HEART = [
    # The folder holds this wall twice: whole (MM474) and cut into twelve segments that lie in the
    # same place (their volumes add up to the whole). Only the whole one is used.
    ("FMA84850", "Free wall of left ventricle", ("MM474",)),
    ("FMA9345", "Septal wall of left ventricle"),
    ("FMA49207", "Wall of inflow part of right ventricle"),
    ("FMA49208", "Wall of outflow part of right ventricle"),
    ("FMA49292", "Anterior wall proper of left atrium"),
    ("FMA9306", "Lateral wall of left atrium"),
    ("FMA9542", "Posterior wall of left atrium"),
    ("FMA9562", "Superior wall of left atrium"),
    ("FMA84095", "Septal wall of left atrium"),
    ("FMA9547", "Wall of left auricle"),
    ("FMA49285", "Anterior wall proper of right atrium"),
    ("FMA49286", "Lateral wall proper of right atrium"),
    ("FMA84094", "Septal wall of right atrium"),
    ("FMA49299", "Wall of right auricle proper"),
    ("FMA23733", "Ascending aorta proper"),
    ("FMA15098", "Wall of bulb of aorta"),
    ("FMA15086", "Pulmonary trunk proper"),
]
# Where each trunk begins: the part its first piece touches.
ORIGIN = {
    "lad": ("FMA4685", "Stem of left coronary artery"),
    "lcx": ("FMA4685", "Stem of left coronary artery"),
    "rca": ("FMA15098", "Wall of bulb of aorta"),
    "left_main": ("FMA15098", "Wall of bulb of aorta"),
}

# --- viewer space ------------------------------------------------------------------------------
# Source: millimetres, +x patient's left, +y posterior, +z up.
# Viewer (heartShape.ts): +x patient's left, +y up, +z towards the viewer in the front view.
MODEL_HEIGHT = 2.9  # viewer units from the lowest to the highest point of the model
MODEL_CENTER = (0.05, 0.3, 0.0)  # = CAMERA_TARGET in ViewPresets.tsx, the point the camera orbits

LINK_MM = 0.5  # pieces of one trunk closer than this are joined when tracing its centre line
CENTERLINE_BIN_MM = 2.0
CENTERLINE_STEP_MM = 3.0
ANCHOR_FRACTIONS = tuple(round(0.06 + 0.08 * step, 2) for step in range(12))  # 0.06 to 0.94
ANCHOR_LIFT_MM = 3.0  # label anchors sit this far outside the artery's centre line
SURFACE_RADIUS_MM = 9.0  # heart surface within this distance gives a first guess of "outwards"
SIGHT_LINES = 160  # directions tried from each anchor to find where it can be seen from
MIN_OPEN_SKY = 0.12  # an anchor seen from a smaller share of all directions is not used
DECIMALS = 4

FILE_NAME = re.compile(r"^(MM\d+)_(BP\d+)_(FMA\d+)_(.+)\.obj$")


@dataclass
class Part:
    file_id: str
    fma: str
    name: str
    vertices: np.ndarray  # N x 3, source millimetres
    normals: np.ndarray  # N x 3
    faces: np.ndarray  # M x 3


def read_obj(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    vertices, normals, faces = [], [], []
    with path.open(encoding="utf-8", errors="replace") as lines:
        for line in lines:
            if line.startswith("v "):
                vertices.append([float(value) for value in line.split()[1:4]])
            elif line.startswith("vn "):
                normals.append([float(value) for value in line.split()[1:4]])
            elif line.startswith("f "):
                corners = [token.split("/") for token in line.split()[1:]]
                index = [int(corner[0]) - 1 for corner in corners]
                if any(len(corner) == 3 and corner[2] and int(corner[2]) - 1 != i for corner, i in zip(corners, index)):
                    raise ValueError(f"{path.name}: a face uses a normal index different from its vertex index")
                for k in range(1, len(index) - 1):
                    faces.append([index[0], index[k], index[k + 1]])
    vertices, normals, faces = np.array(vertices), np.array(normals), np.array(faces, dtype=np.int64)
    if len(normals) != len(vertices):
        raise ValueError(f"{path.name}: expected one normal per vertex")
    return vertices, normals, faces


def load_parts(source: Path) -> dict[str, list[Part]]:
    """Every part in the folder, grouped by FMA id."""
    parts: dict[str, list[Part]] = {}
    for path in sorted(source.glob("*.obj")):
        match = FILE_NAME.match(path.name)
        if not match:
            raise ValueError(f"Unexpected file name: {path.name}")
        file_id, _, fma, name = match.groups()
        parts.setdefault(fma, []).append(Part(file_id, fma, name, *read_obj(path)))
    if not parts:
        raise FileNotFoundError(f"No .obj files in {source}")
    return parts


def select(parts: dict[str, list[Part]], wanted: list[tuple]) -> list[Part]:
    """The files of the listed structures; the name must match the id, so a wrong file cannot slip in.

    An entry is (FMA id, English name) or (FMA id, English name, file ids) to take only those files.
    """
    chosen = []
    for fma, name, *only in wanted:
        found = parts.get(fma)
        if not found:
            raise KeyError(f"{fma} ({name}) is not in the source folder")
        for part in found:
            if part.name != name:
                raise ValueError(f"{part.file_id}: {fma} is named {part.name!r}, expected {name!r}")
        if only:
            found = [part for part in found if part.file_id in only[0]]
            if len(found) != len(only[0]):
                raise KeyError(f"{fma} ({name}): expected the files {only[0]}")
        chosen.extend(found)
    return chosen


# --- geometry ----------------------------------------------------------------------------------


def to_viewer_axes(points: np.ndarray) -> np.ndarray:
    """A rotation (no mirroring): source (x, y, z) -> viewer (x, z, -y)."""
    return np.stack([points[:, 0], points[:, 2], -points[:, 1]], axis=1)


class Placement:
    """Source millimetres -> viewer units: rotate, scale to MODEL_HEIGHT, centre on MODEL_CENTER."""

    def __init__(self, every_part: list[Part]):
        points = to_viewer_axes(np.concatenate([part.vertices for part in every_part]))
        low, high = points.min(axis=0), points.max(axis=0)
        self.scale = MODEL_HEIGHT / (high[1] - low[1])
        self.offset = np.array(MODEL_CENTER) - self.scale * (low + high) / 2

    def points(self, source_mm: np.ndarray) -> np.ndarray:
        return to_viewer_axes(source_mm) * self.scale + self.offset

    def directions(self, source: np.ndarray) -> np.ndarray:
        rotated = to_viewer_axes(source)
        return rotated / np.linalg.norm(rotated, axis=1, keepdims=True)


def merge(pieces: list[Part]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    vertices = np.concatenate([piece.vertices for piece in pieces])
    normals = np.concatenate([piece.normals for piece in pieces])
    offsets = np.cumsum([0] + [len(piece.vertices) for piece in pieces[:-1]])
    faces = np.concatenate([piece.faces + offset for piece, offset in zip(pieces, offsets)])
    return vertices, normals, faces


def weld(vertices: np.ndarray, normals: np.ndarray, faces: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """One vertex per position with the mean normal: smooth all round, as a vessel should be."""
    _, first, inverse = np.unique(np.round(vertices, 4), axis=0, return_index=True, return_inverse=True)
    inverse = inverse.reshape(-1)
    summed = np.zeros((len(first), 3))
    np.add.at(summed, inverse, normals)
    length = np.linalg.norm(summed, axis=1, keepdims=True)
    welded_faces = inverse[faces]
    distinct = (
        (welded_faces[:, 0] != welded_faces[:, 1])
        & (welded_faces[:, 1] != welded_faces[:, 2])
        & (welded_faces[:, 0] != welded_faces[:, 2])
    )
    return vertices[first], summed / np.where(length > 0, length, 1), welded_faces[distinct]


def centre_line(pieces: list[Part], origin: list[Part]) -> tuple[np.ndarray, float]:
    """Centre line of a tube-like vessel in source millimetres, from its origin outwards, and its radius.

    Vertices are binned by their distance along the surface from the end that touches `origin`;
    the centre of each bin is a point of the line.
    """
    vertices, _, faces = merge(pieces)
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    links = cKDTree(vertices).query_pairs(LINK_MM, output_type="ndarray")  # joins the pieces
    edges = np.concatenate([edges, links])
    lengths = np.linalg.norm(vertices[edges[:, 0]] - vertices[edges[:, 1]], axis=1)
    count = len(vertices)
    graph = coo_matrix((lengths, (edges[:, 0], edges[:, 1])), shape=(count, count)).tocsr()

    to_origin, _ = cKDTree(np.concatenate([part.vertices for part in origin])).query(vertices)
    start = int(np.argmin(to_origin))
    along = dijkstra(graph, directed=False, indices=start)
    if not np.isfinite(along).all():
        names = ", ".join(piece.file_id for piece in pieces)
        raise ValueError(f"The pieces {names} do not form one connected vessel")

    bins = np.floor(along / CENTERLINE_BIN_MM).astype(int)
    line, radii = [], []
    for index in range(bins.max() + 1):
        ring = vertices[bins == index]
        if len(ring) < 4:
            continue
        centre = ring.mean(axis=0)
        line.append(centre)
        radii.append(np.median(np.linalg.norm(ring - centre, axis=1)))
    line = np.array(line)
    # A light smoothing, then points at equal steps.
    smooth = line.copy()
    smooth[1:-1] = (line[:-2] + 2 * line[1:-1] + line[2:]) / 4
    travelled = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(smooth, axis=0), axis=1))])
    steps = max(5, int(np.ceil(travelled[-1] / CENTERLINE_STEP_MM)) + 1)
    at = np.linspace(0, travelled[-1], steps)
    resampled = np.stack([np.interp(at, travelled, smooth[:, axis]) for axis in range(3)], axis=1)
    return resampled, float(np.median(radii))


def point_at(line: np.ndarray, fraction: float) -> np.ndarray:
    travelled = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))])
    return np.array([np.interp(fraction * travelled[-1], travelled, line[:, axis]) for axis in range(3)])


def sphere_directions(count: int) -> np.ndarray:
    """Evenly spread unit vectors (a Fibonacci sphere)."""
    index = np.arange(count) + 0.5
    polar = np.arccos(1 - 2 * index / count)
    around = np.pi * (1 + 5**0.5) * index
    return np.stack([np.cos(around) * np.sin(polar), np.sin(around) * np.sin(polar), np.cos(polar)], axis=1)


class Occluder:
    """The heart surface as triangles, for asking whether a line of sight is free."""

    def __init__(self, vertices: np.ndarray, faces: np.ndarray):
        self.corner = vertices[faces[:, 0]]
        self.edge1 = vertices[faces[:, 1]] - self.corner
        self.edge2 = vertices[faces[:, 2]] - self.corner

    def free(self, origin: np.ndarray, direction: np.ndarray) -> bool:
        """True when a ray from `origin` along `direction` meets no triangle (Moeller-Trumbore)."""
        h = np.cross(direction, self.edge2)
        a = np.einsum("ij,ij->i", self.edge1, h)
        usable = np.abs(a) > 1e-12
        f = np.where(usable, 1.0 / np.where(usable, a, 1.0), 0.0)
        s = origin - self.corner
        u = f * np.einsum("ij,ij->i", s, h)
        q = np.cross(s, self.edge1)
        v = f * (q @ direction)
        t = f * np.einsum("ij,ij->i", self.edge2, q)
        return not bool((usable & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-6)).any())

    def open_directions(self, origin: np.ndarray, directions: np.ndarray) -> np.ndarray:
        return np.array([direction for direction in directions if self.free(origin, direction)]).reshape(-1, 3)


def label_anchors(line: np.ndarray, heart_vertices: np.ndarray, heart_normals: np.ndarray, tree: cKDTree, occluder: Occluder) -> list[dict]:
    """Places along a vessel where its label may sit.

    Each anchor is a point just outside the vessel together with the middle of the directions it
    can be seen from. A vessel in a groove or under an auricle is only visible from a narrow range
    of directions; a place that can hardly be seen from anywhere gets no anchor.
    """
    directions = sphere_directions(SIGHT_LINES)
    anchors = []
    for fraction in ANCHOR_FRACTIONS:
        centre = point_at(line, fraction)
        near = tree.query_ball_point(centre, SURFACE_RADIUS_MM)
        if not near:
            continue
        distance = np.linalg.norm(heart_vertices[near] - centre, axis=1)
        weight = np.exp(-((distance / (SURFACE_RADIUS_MM / 2)) ** 2))
        outward = (heart_normals[near] * weight[:, None]).sum(axis=0)
        outward /= np.linalg.norm(outward) or 1.0
        # Two rounds: look around from the first guess, then again from the improved point.
        seen = np.empty((0, 3))
        for _ in range(2):
            seen = occluder.open_directions(centre + outward * ANCHOR_LIFT_MM, directions)
            if len(seen) == 0:
                break
            outward = seen.mean(axis=0)
            outward /= np.linalg.norm(outward) or 1.0
        if len(seen) < MIN_OPEN_SKY * SIGHT_LINES:
            continue
        anchors.append({"point": centre + outward * ANCHOR_LIFT_MM, "normal": outward, "open": len(seen) / SIGHT_LINES})
    return anchors


# --- GLB ---------------------------------------------------------------------------------------


def write_glb(path: Path, meshes: list[dict]) -> None:
    """A minimal binary glTF 2.0 file: one node, mesh and material per entry, positions and normals."""
    binary = bytearray()
    views, accessors, nodes, gltf_meshes, materials = [], [], [], [], []

    def add(data: np.ndarray, target: int, accessor: dict) -> int:
        while len(binary) % 4:
            binary.append(0)
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": data.nbytes, "target": target})
        binary.extend(data.tobytes())
        accessors.append({"bufferView": len(views) - 1, **accessor})
        return len(accessors) - 1

    for mesh in meshes:
        positions = mesh["positions"].astype("<f4")
        normals = mesh["normals"].astype("<f4")
        indices = mesh["faces"].astype("<u4").reshape(-1)
        position = add(positions, 34962, {
            "componentType": 5126, "count": len(positions), "type": "VEC3",
            "min": positions.min(axis=0).tolist(), "max": positions.max(axis=0).tolist(),
        })
        normal = add(normals, 34962, {"componentType": 5126, "count": len(normals), "type": "VEC3"})
        index = add(indices, 34963, {"componentType": 5125, "count": len(indices), "type": "SCALAR"})
        materials.append({
            "name": mesh["name"],
            "pbrMetallicRoughness": {"baseColorFactor": mesh["color"], "metallicFactor": 0, "roughnessFactor": 0.8},
        })
        gltf_meshes.append({
            "primitives": [{"attributes": {"POSITION": position, "NORMAL": normal}, "indices": index, "material": len(materials) - 1}],
        })
        # Only the node carries the name: loaders keep names unique, and a mesh of the same name
        # would make them rename the node.
        nodes.append({"name": mesh["name"], "mesh": len(gltf_meshes) - 1})

    while len(binary) % 4:
        binary.append(0)
    document = {
        "asset": {"version": "2.0", "generator": "CardioLens tools/heart_model/build_heart.py"},
        "scene": 0,
        "scenes": [{"name": "heart-model", "nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gltf_meshes,
        "materials": materials,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
    }
    text = json.dumps(document, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as out:
        out.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(text) + 8 + len(binary)))
        out.write(struct.pack("<I4s", len(text), b"JSON"))
        out.write(text)
        out.write(struct.pack("<I4s", len(binary), b"BIN\x00"))
        out.write(binary)


def compress(raw: Path, out: Path, simplify_ratio: float) -> None:
    """Weld, simplify and meshopt-compress with glTF-Transform. Objects keep their names."""
    npx = shutil.which("npx")
    if not npx:
        raise RuntimeError("npx was not found; install Node.js or pass --skip-compress")
    with tempfile.TemporaryDirectory() as folder:
        welded, simplified = Path(folder) / "welded.glb", Path(folder) / "simplified.glb"
        steps = [
            ["weld", str(raw), str(welded)],
            ["simplify", str(welded), str(simplified), "--ratio", str(simplify_ratio), "--error", "0.0005"],
            ["meshopt", str(simplified), str(out), "--level", "medium"],
        ]
        out.parent.mkdir(parents=True, exist_ok=True)
        for step in steps:
            subprocess.run([npx, "--yes", GLTF_TRANSFORM, *step], check=True)


# --- data file for the viewer --------------------------------------------------------------------


def number(value: float, decimals: int = DECIMALS) -> str:
    text = f"{value:.{decimals}f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def vector(values, decimals: int = DECIMALS) -> str:
    return "[" + ", ".join(number(float(value), decimals) for value in values) + "]"


def write_data(path: Path, placement: Placement, bounds: tuple[np.ndarray, np.ndarray], arteries: list[dict], sources: dict) -> None:
    lines = [
        "// Generated by tools/heart_model/build_heart.py from the BodyParts3D heart parts. Do not edit by hand:",
        "// change the script and run it again, so this file and public/models/heart.glb stay in step.",
        "//",
        "// Centre lines and label anchors of the coronary arteries in the heart model's coordinate space",
        "// (DATA_MODEL §8): +x is the patient's left, +y is up, +z points at the viewer in the front view.",
        "",
        'import type { ArteryPath } from "./arteryPaths";',
        "",
        "/** Viewer units per millimetre of the source anatomy. */",
        f"export const MODEL_UNITS_PER_MM = {number(placement.scale, 6)};",
        "",
        "/** Bounding box of the whole model. Its centre is the point the camera orbits. */",
        f"export const MODEL_BOUNDS = {{ min: {vector(bounds[0])}, max: {vector(bounds[1])} }} as const;",
        "",
        "/** The anatomical structures behind each object of the model, by FMA id. */",
        "export const MODEL_SOURCES: Record<string, readonly { fma: string; name: string; files: number }[]> = {",
    ]
    for name, entries in sources.items():
        lines.append(f'  "{name}": [')
        for entry in entries:
            lines.append(f'    {{ fma: "{entry["fma"]}", name: "{entry["name"]}", files: {entry["files"]} }},')
        lines.append("  ],")
    lines += ["};", "", "export const MODEL_ARTERY_PATHS: readonly ArteryPath[] = ["]
    for artery in arteries:
        lines.append("  {")
        lines.append(f'    id: "{artery["id"]}",')
        lines.append(f"    radius: {number(artery['radius'])},")
        lines.append(f"    interactive: {'true' if artery['interactive'] else 'false'},")
        lines.append("    points: [")
        for point in artery["points"]:
            lines.append(f"      {vector(point)},")
        lines.append("    ],")
        if artery["anchors"]:
            lines.append("    labelAnchors: [")
            for anchor in artery["anchors"]:
                lines.append(f"      {{ point: {vector(anchor['point'])}, normal: {vector(anchor['normal'], 5)} }},")
            lines.append("    ],")
        else:
            lines.append("    labelAnchors: [],")
        lines.append("  },")
    lines += ["];", ""]
    path.write_text("\n".join(lines), encoding="utf-8", newline="\n")


# --- main ----------------------------------------------------------------------------------------


def describe(pieces: list[Part]) -> list[dict]:
    """The structures behind an object, in the order they were listed, with their file count."""
    seen: dict[str, dict] = {}
    for piece in pieces:
        entry = seen.setdefault(piece.fma, {"fma": piece.fma, "name": piece.name, "files": 0})
        entry["files"] += 1
    return list(seen.values())


def build(source: Path, raw_out: Path, skip_compress: bool, simplify_ratio: float) -> None:
    parts = load_parts(source)
    heart = select(parts, HEART)
    vessels = {target: select(parts, wanted) for target, wanted in VESSELS.items()}
    left_main = select(parts, LEFT_MAIN)
    branches = select(parts, BRANCHES)
    everything = heart + left_main + branches + [piece for pieces in vessels.values() for piece in pieces]
    placement = Placement(everything)

    def mesh(name: str, pieces: list[Part], color: list[float], smooth: bool) -> dict:
        vertices, normals, faces = merge(pieces)
        if smooth:
            vertices, normals, faces = weld(vertices, normals, faces)
        return {
            "name": name, "color": color, "faces": faces,
            "positions": placement.points(vertices), "normals": placement.directions(normals),
        }

    # Colours are placeholders: the viewer supplies its own materials.
    meshes = [mesh("heart", heart, [0.91, 0.89, 0.87, 1], smooth=False)]
    meshes.append(mesh("artery-branches", branches, [0.45, 0.5, 0.56, 1], smooth=True))
    meshes.append(mesh("artery-left-main", left_main, [0.39, 0.45, 0.55, 1], smooth=True))
    for target, pieces in vessels.items():
        meshes.append(mesh(f"artery-{target}", pieces, [0.58, 0.64, 0.72, 1], smooth=True))
    write_glb(raw_out, meshes)

    heart_vertices, heart_normals, heart_faces = merge(heart)
    tree = cKDTree(heart_vertices)
    occluder = Occluder(heart_vertices, heart_faces)
    arteries = []
    for target, pieces in [("left_main", left_main), *vessels.items()]:
        line, radius = centre_line(pieces, select(parts, [ORIGIN[target]]))
        interactive = target != "left_main"
        anchors = label_anchors(line, heart_vertices, heart_normals, tree, occluder) if interactive else []
        arteries.append({
            "id": target,
            "radius": radius * placement.scale,
            "interactive": interactive,
            "points": placement.points(line),
            "anchors": [
                {"point": placement.points(anchor["point"][None])[0], "normal": placement.directions(anchor["normal"][None])[0]}
                for anchor in anchors
            ],
        })
        length = np.linalg.norm(np.diff(line, axis=0), axis=1).sum()
        print(f"  {target}: {len(pieces)} piece(s), {length:.0f} mm long, radius {radius:.2f} mm, {len(anchors)} label anchors")

    every_point = np.concatenate([entry["positions"] for entry in meshes])
    bounds = (every_point.min(axis=0), every_point.max(axis=0))
    sources = {
        "heart": describe(heart),
        "artery-branches": describe(branches),
        "artery-left-main": describe(left_main),
        **{f"artery-{target}": describe(pieces) for target, pieces in vessels.items()},
    }
    write_data(DATA_OUT, placement, bounds, arteries, sources)

    triangles = {entry["name"]: len(entry["faces"]) for entry in meshes}
    print(f"  scale {placement.scale:.6f} units/mm, triangles {triangles}, total {sum(triangles.values())}")
    print(f"  wrote {raw_out} ({raw_out.stat().st_size / 1e6:.2f} MB) and {DATA_OUT.relative_to(REPO)}")
    if skip_compress:
        return
    compress(raw_out, MODEL_OUT, simplify_ratio)
    print(f"  wrote {MODEL_OUT.relative_to(REPO)} ({MODEL_OUT.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--source", required=True, type=Path, help="folder with the BodyParts3D .obj files")
    parser.add_argument("--raw-out", type=Path, default=Path(tempfile.gettempdir()) / "cardiolens-heart-raw.glb",
                        help="where to write the uncompressed model (default: the system temp folder)")
    parser.add_argument("--simplify-ratio", type=float, default=0.75, help="share of triangles to keep (default 0.75)")
    parser.add_argument("--skip-compress", action="store_true", help="stop after the uncompressed model and the data file")
    arguments = parser.parse_args()
    build(arguments.source, arguments.raw_out, arguments.skip_compress, arguments.simplify_ratio)
