# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.3.5", "rtree==1.4.1", "scipy==1.16.3", "trimesh==4.9.0"]
# ///

"""Rebuild the AMMT Overhang Part X4 CAD-to-scan fixture from NIST.

Download OverhangPart_9x5x5mm.STL and OverhangPartX4 Part4 Surface_cleaned.zip
from https://doi.org/10.18434/mds2-2291. Run:

    uv run derive-cad-scan.py nominal.stl part4.zip > cad-scan-data.ts

The measured surface is already aligned by NIST. A local 3-2-1 datum fit
refines only the rigid frame, with no scale adjustment or form correction.
"""

import argparse
import hashlib
from pathlib import Path
from struct import unpack
from zipfile import ZipFile

import numpy as np
import trimesh


NOMINAL_SHA256 = "d9fc086ca8c0bc3722709e5c03a39c5c1cf60553845ff62f5699780e1d3c1734"
SCAN_SHA256 = "360ab2f761d298818c96cfc6bf46696bfd3c125d541f2893f366fe3059e5cdbc"
SCAN_MEMBER = "OverhangPartX4 Part4 Surface_cleaned.stl"
STL_TRIANGLE = np.dtype([("normal", "<f4", (3,)), ("vertices", "<f4", (3, 3)), ("attribute", "<u2")])
DATUM_WINDOWS = (
    ((-.12, .12), (.23, 4.77), (.18, 4.40)),
    ((1, 8), (-.2, .2), (.7, 3.7)),
    ((.6, 8.4), (.6, 4.4), (-.2, .2)),
)
GRID_MM = .32


def verify_file(path, expected_hash):
    with path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != expected_hash:
            raise ValueError(f"File hash differs from the NIST record: {path}.")


def source_vertices(path):
    batches = []
    with ZipFile(path) as archive, archive.open(SCAN_MEMBER) as stl:
        stl.read(80)
        triangle_count, = unpack("<I", stl.read(4))
        if triangle_count != 7863382:
            raise ValueError("Unexpected Part 4 triangle count.")
        # This batch size is a multiple of 32, so sampling is independent of file boundaries.
        for start in range(0, triangle_count, 65536):
            size = min(65536, triangle_count - start) * STL_TRIANGLE.itemsize
            triangles = np.frombuffer(stl.read(size), dtype=STL_TRIANGLE)
            batches.append(triangles[::32]["vertices"].reshape(-1, 3).copy())
        if stl.read(1):
            raise ValueError("Unexpected bytes after the Part 4 STL mesh.")
    return np.unique(np.concatenate(batches), axis=0).astype(float)


def fit_datum(points, axis):
    center = points.mean(axis=0)
    _, _, basis = np.linalg.svd(points - center, full_matrices=False)
    normal = basis[-1].copy()
    if normal[axis] < 0:
        normal *= -1
    return center, normal


def datum_points(points, axis, window):
    low, high = np.asarray(window).T
    selected = points[np.all((points > low) & (points < high), axis=1)]
    if axis == 0:
        # The −X end is a plane outside the cylindrical bore, centered at Y = Z = 2.5 mm.
        selected = selected[np.linalg.norm(selected[:, 1:] - 2.5, axis=1) > 2.15]
    for _ in range(3):
        center, normal = fit_datum(selected, axis)
        residual = np.abs((selected - center) @ normal)
        selected = selected[residual < np.median(residual) * 3.5]
    return selected


def register(points):
    datums = [datum_points(points, axis, window) for axis, window in enumerate(DATUM_WINDOWS)]
    centers, normals = zip(*(fit_datum(datum, axis) for axis, datum in enumerate(datums)), strict=True)
    z_axis = normals[2]
    y_axis = normals[1] - z_axis * np.dot(normals[1], z_axis)
    y_axis /= np.linalg.norm(y_axis)
    x_axis = np.cross(y_axis, z_axis)
    rotation = np.stack([x_axis, y_axis, z_axis])
    offset = np.einsum("ij,ij->i", rotation, centers)
    if not np.isclose(np.linalg.det(rotation), 1):
        raise ValueError("Expected a proper rigid datum rotation.")
    return points @ rotation.T - offset


def sample_grid(points):
    grid_coordinates = points / GRID_MM
    cells = np.floor(grid_coordinates)
    _, groups = np.unique(cells, axis=0, return_inverse=True)
    displacement = grid_coordinates - cells - .5
    squared_distance = np.einsum("ij,ij->i", displacement, displacement)
    order = np.lexsort((squared_distance, groups))
    return points[order[np.r_[True, np.diff(groups[order]) > 0]]]


def display_mesh(nominal):
    vertices = nominal.vertices
    radial = np.linalg.norm(vertices[:, 1:] - 2.5, axis=1)
    remap = np.arange(len(vertices))
    for x in (0, 3):
        ring = np.flatnonzero((vertices[:, 0] == x) & (np.abs(radial - 2) < .00001))
        angles = np.arctan2(vertices[ring, 2] - 2.4999999, vertices[ring, 1] - 2.5)
        ordered_ring = ring[np.argsort(angles, kind="stable")]
        if len(ordered_ring) != 720:
            raise ValueError("Expected the original nominal bore tessellation.")
        remap[ordered_ring[1::2]] = ordered_ring[::2]
    faces = remap[nominal.faces]
    a, b, c = faces.T
    mesh = trimesh.Trimesh(vertices, faces[(a != b) & (a != c) & (b != c)], process=False)
    mesh.remove_unreferenced_vertices()
    if not (mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0):
        raise ValueError("Reduced display mesh must retain closed outward winding.")
    return mesh


def coordinate_text(values):
    return "[" + ", ".join(str(round(float(value), 6)) for value in values) + "]"


def typescript_fixture(nominal_path, scan_path):
    verify_file(nominal_path, NOMINAL_SHA256)
    verify_file(scan_path, SCAN_SHA256)
    nominal = trimesh.load_mesh(nominal_path, file_type="stl", process=True)
    if not (nominal.is_watertight and nominal.is_winding_consistent and nominal.volume > 0):
        raise ValueError("Original CAD mesh must have closed outward winding.")
    measured = sample_grid(register(source_vertices(scan_path)))
    closest, distances, triangle_ids = trimesh.proximity.closest_point(nominal, measured)
    normal_projection = np.einsum("ij,ij->i", measured - closest, nominal.face_normals[triangle_ids])
    signed_distances = np.where(normal_projection < 0, -distances, distances)
    display = display_mesh(nominal)

    lines = [
        "// Generated by derive-cad-scan.py from the NIST AMMT Overhang Part X4 dataset.",
        "// Measurements are subject to NIST data terms. See THIRD_PARTY_NOTICES.md.",
        "import type { CadScanDeviationData } from './CadScanDeviation'",
        "",
        "export const cadScanSource = {",
        "  label: 'Maxwell Praniewicz et al., NIST AMMT Overhang Part X4',",
        "  href: 'https://doi.org/10.18434/mds2-2291',",
        "  description: 'As-designed CAD and the measured XCT surface of additively manufactured Part 4. Signed distances use the full nominal surface after datum alignment.',",
        "  license: 'NIST data terms',",
        "  licenseUrl: 'https://www.nist.gov/open/license',",
        "}",
        "",
        "export const cadScanData: CadScanDeviationData = {",
        "  nominal: {",
        "    vertices: [",
    ]
    lines.extend(f"      {coordinate_text(vertex)}," for vertex in display.vertices)
    lines.extend(["    ],", "    triangles: ["])
    lines.extend(f"      [{a}, {b}, {c}]," for a, b, c in display.faces)
    lines.extend(["    ],", "  },", "  scan: ["])
    for point, contact, deviation in zip(measured, closest, signed_distances, strict=True):
        lines.append(
            f"    {{ point: {coordinate_text(point)}, closest: {coordinate_text(contact)}, deviationMm: {deviation:.6f} }},"
        )
    lines.extend(["  ],", "  sectionAxis: 'y',", "  colorLimitMm: 0.6,", "  toleranceMm: 0.1,", "}"])
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("nominal_stl", type=Path)
    parser.add_argument("measured_zip", type=Path)
    args = parser.parse_args()
    print(typescript_fixture(args.nominal_stl, args.measured_zip))
