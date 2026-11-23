# /// script
# requires-python = ">=3.12"
# dependencies = ["h5py==3.16.0", "numpy==2.5.5"]
# ///

"""Rebuild the measured T-shaped polyurethane strain fixture.

Download TPS_2.hdf5 and force_vfm.csv from https://doi.org/10.5281/zenodo.18617429.
Run uv run derive-full-field-strain.py path/to/downloads > full-field-strain-fixture.json.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re

import h5py
import numpy as np


FILES = {
    "TPS_2.hdf5": "82bdd3f39819cc1844baa9a61ccc61e387198fca03b8a705e535bca0255c9401",
    "force_vfm.csv": "7e03f65947c6eb238b9b4fb00d70f4ce5c05709dcc17f092af93f7cb00ee8490",
}
FRAMES = (1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 63)
PIXEL_MM = 0.021  # Table 3, https://doi.org/10.1016/j.compstruc.2026.108356.
NATIVE_PITCH_PX = 5
DISPLAY_STRIDE = 5
STRAIN_DOMAIN_PERCENT = (-5, 70)


def verify_inputs(directory):
    for filename, expected in FILES.items():
        with (directory / filename).open("rb") as source:
            if hashlib.file_digest(source, "sha256").hexdigest() != expected:
                raise ValueError(f"{filename} does not match the published measurement snapshot.")


def forces_newtons(path):
    with path.open(encoding="ascii") as stream:
        if stream.readline().strip() != "force [N]":
            raise ValueError("Unexpected force units.")
        forces = np.loadtxt(stream)
    if forces.shape != (63,) or not np.isfinite(forces).all():
        raise ValueError("Expected one finite measured force for each of the 63 loaded frames.")
    return forces


def reference_grid(nodes):
    if nodes.ndim != 2 or nodes.shape[1] != 3 or not np.isfinite(nodes).all():
        raise ValueError("Expected x, y, validity columns in the DIC region.")
    x_px = np.unique(nodes[:, 0])
    y_px = np.unique(nodes[:, 1])
    if not ((np.diff(x_px) == NATIVE_PITCH_PX).all() and (np.diff(y_px) == NATIVE_PITCH_PX).all()):
        raise ValueError("Expected the native 5 px reference lattice.")
    columns = np.searchsorted(x_px, nodes[:, 0])
    rows = np.searchsorted(y_px, nodes[:, 1])
    if len(np.unique(rows * x_px.size + columns)) != len(nodes):
        raise ValueError("Repeated native DIC node.")
    return x_px, y_px, rows, columns


def axial_strain_percent(displacement_grid):
    # Fit each displacement component's local y slope to offsets −2, −1, 0, 1, 2.
    # Pixel units cancel. Reversing the image y-axis also flips u_y, leaving E_yy unchanged.
    slope = np.full_like(displacement_grid, np.nan)
    slope[2:-2] = (
        -2 * displacement_grid[:-4] - displacement_grid[1:-3]
        + displacement_grid[3:-1] + 2 * displacement_grid[4:]
    ) / (10 * NATIVE_PITCH_PX)
    slope[~np.isfinite(displacement_grid).all(axis=-1)] = np.nan
    return 100 * (slope[..., 1] + 0.5 * np.sum(slope ** 2, axis=-1))


def derive(directory):
    verify_inputs(directory)
    forces = forces_newtons(directory / "force_vfm.csv")
    with h5py.File(directory / "TPS_2.hdf5", "r") as source:
        nodes = source["region/nodes"][:]
        x_px, y_px, rows, columns = reference_grid(nodes)
        validity = nodes[:, 2] == 1
        images = source["images/dsp"]
        displacements = source["output/u"]
        keys = [f"{frame:05d}" for frame in range(64)]
        if list(images.keys()) != keys or list(displacements.keys()) != keys:
            raise ValueError("Expected reference frame 00000 and 63 loaded frames.")

        times = [round(float(images[key].attrs["time"]), 6) for key in keys]
        displacement_times = [round(float(displacements[key].attrs["time"]), 6) for key in keys]
        if times[0] != 0 or not (np.diff(times) > 0).all() or times != displacement_times:
            raise ValueError("Inconsistent time stamps in the image and DIC datasets.")
        if not (displacements[keys[0]][validity, :2] == 0).all():
            raise ValueError("Expected the first frame to be the zero-displacement reference.")

        # The force table covers only loaded frames. The reference frame has no recorded force.
        force_history = [
            {"stage": time, "forceN": float(force)} for time, force in zip(times[1:], forces, strict=True)
        ]
        x_indices = np.arange(x_px.size)[::DISPLAY_STRIDE]
        y_indices = np.arange(y_px.size)[::-DISPLAY_STRIDE]
        frames = []
        for frame in FRAMES:
            displacement = displacements[keys[frame]][:, :2]
            if displacement.shape != (len(nodes), 2):
                raise ValueError(f"Unaligned displacement samples in frame {frame}.")
            grid = np.full((len(y_px), len(x_px), 2), np.nan)
            grid[rows[validity], columns[validity]] = displacement[validity]
            strain = axial_strain_percent(grid)[np.ix_(y_indices, x_indices)]
            rounded = np.round(strain.ravel(), 3)
            frames.append({
                **force_history[frame - 1],
                "strainPercent": [float(value) if np.isfinite(value) else None for value in rounded],
            })

    return {
        "xMm": np.round((x_px[x_indices] - x_px[0]) * PIXEL_MM, 3).tolist(),
        "yMm": np.round((y_px[-1] - y_px[y_indices]) * PIXEL_MM, 3).tolist(),
        "componentLabel": "Green–Lagrange strain Eᵧᵧ",
        "stageLabel": "Elapsed time",
        "stageUnit": "s",
        "strainDomainPercent": STRAIN_DOMAIN_PERCENT,
        "frames": frames,
        "forceHistory": force_history,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory containing both published recordings")
    formatted = json.dumps(derive(parser.parse_args().directory), indent=2, ensure_ascii=False, allow_nan=False)
    print(re.sub(r"\[((?:[\s\d.,-]|null)+)\]", lambda match: "[" + " ".join(match[1].split()) + "]", formatted))
