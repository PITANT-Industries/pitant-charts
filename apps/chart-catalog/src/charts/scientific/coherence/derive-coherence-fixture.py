# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.5"]
# ///

"""Rebuild the coherence fixture from the two specified Zenodo LVM recordings.

From https://zenodo.org/records/14388093, extract these archive members into one directory:
  Baseline.zip: Baseline/30Hz/Normal_30Hz_001.lvm
  Unbalance_DE.zip: Desbalanc1LA/30Hz/Desbalanc1_30Hz_001.lvm
Run uv run derive-coherence-fixture.py path/to/recordings > coherence-fixture.json.
"""

import argparse
import hashlib
from io import StringIO
import json
from pathlib import Path
import re

import numpy as np


SOURCE = {
    "label": "Universidade de São Paulo rotating-machine test rig",
    "href": "https://doi.org/10.5281/zenodo.14388093",
    "description": "Paired horizontal accelerometer recordings at the drive and non-drive ends of the same rotor, measured at a nominal shaft speed of 30 Hz.",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creators": ["Amanda Lucatto Marra", "Claudio Garcia"],
    "datasetTitle": "Vibration signals of different fault conditions in a generic rotating machine",
    "relatedPaper": "https://doi.org/10.1109/ICSRS53853.2021.9660628",
}

RECORDINGS = (
    {
        "id": "baseline",
        "label": "Baseline",
        "archive": "Baseline.zip",
        "member": "Baseline/30Hz/Normal_30Hz_001.lvm",
        "sha256": "64d5389b4afc4594f321ff24ba61bfb9244df3aa75bf87ff63dbffa61268525c",
    },
    {
        "id": "drive-end-unbalance",
        "label": "Drive-end unbalance",
        "archive": "Unbalance_DE.zip",
        "member": "Desbalanc1LA/30Hz/Desbalanc1_30Hz_001.lvm",
        "sha256": "4cbbb93bd10f46ab1e4aef5d079031967e39c333c9b3efd9d12c2b5249f34da7",
    },
)

SAMPLE_RATE_HZ = 6_000
SAMPLE_COUNT = 36_000
WINDOW_SAMPLES = 2_048
OVERLAP_SAMPLES = 1_024
MAX_FREQUENCY_HZ = 1_500
REFERENCE_CHANNEL = "Accel Coupled H"
RESPONSE_CHANNEL = "Accel Uncoupled H"


def load_acceleration(path, sha256):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha256:
        raise ValueError(f"{path.name} does not match the expected recording hash.")
    with StringIO(raw.decode("latin-1")) as rows:
        for line in rows:
            if line.startswith("X_Value\t"):
                columns = line.rstrip().split("\t")
                break
        else:
            raise ValueError(f"No LVM measurement columns in {path.name}.")

        acceleration = np.loadtxt(
            rows, delimiter="\t",
            usecols=(columns.index(REFERENCE_CHANNEL), columns.index(RESPONSE_CHANNEL)),
        )
    if acceleration.shape != (SAMPLE_COUNT, 2) or not np.isfinite(acceleration).all():
        raise ValueError(f"Unexpected paired acceleration samples in {path.name}.")
    return acceleration


def cross_spectra(acceleration):
    step = WINDOW_SAMPLES - OVERLAP_SAMPLES
    segments = np.lib.stride_tricks.sliding_window_view(acceleration, WINDOW_SAMPLES, axis=0)[::step]
    centered = segments - segments.mean(axis=-1, keepdims=True)
    taper = np.hanning(WINDOW_SAMPLES + 1)[:-1]
    transformed = np.fft.rfft(centered * taper, axis=-1)
    reference = transformed[:, 0, :]
    response = transformed[:, 1, :]
    reference_power = np.mean(np.abs(reference) ** 2, axis=0)
    response_power = np.mean(np.abs(response) ** 2, axis=0)
    cross_power = np.mean(np.conjugate(reference) * response, axis=0)
    coherence = np.abs(cross_power) ** 2 / (reference_power * response_power)
    return np.clip(coherence, 0, 1), np.angle(cross_power, deg=True)


def derive(directory):
    frequency = np.fft.rfftfreq(WINDOW_SAMPLES, d=1 / SAMPLE_RATE_HZ)
    band = (frequency > 0) & (frequency <= MAX_FREQUENCY_HZ)
    runs = []
    for recording in RECORDINGS:
        path = directory / Path(recording["member"]).name
        coherence, phase = cross_spectra(load_acceleration(path, recording["sha256"]))
        runs.append({
            "id": recording["id"],
            "label": recording["label"],
            "frequencyHz": frequency[band].tolist(),
            "coherence": np.round(coherence[band], 6).tolist(),
            "phaseDeg": np.round(phase[band], 3).tolist(),
        })

    return {
        "source": SOURCE,
        "recordings": RECORDINGS,
        "processing": {
            "shaftSettingHz": 30,
            "sampleRateHz": SAMPLE_RATE_HZ,
            "samplesPerRecording": SAMPLE_COUNT,
            "referenceChannel": REFERENCE_CHANNEL,
            "responseChannel": RESPONSE_CHANNEL,
            "window": "Periodic Hann after subtracting each channel's segment mean",
            "windowSamples": WINDOW_SAMPLES,
            "overlapSamples": OVERLAP_SAMPLES,
            "segments": 1 + (SAMPLE_COUNT - WINDOW_SAMPLES) // (WINDOW_SAMPLES - OVERLAP_SAMPLES),
            "coherence": "Squared magnitude of mean cross-power divided by the product of mean auto-powers",
            "phase": "Angle of mean conjugate(X) times Y in degrees, wrapped to ±180°",
        },
        "runs": runs,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory with both extracted LVM recordings")
    formatted = json.dumps(derive(parser.parse_args().directory), indent=2, allow_nan=False)
    # Preserve the metadata layout and compact the six numeric arrays.
    print(re.sub(r"\[([\s\d.,-]+)\]", lambda match: "[" + " ".join(match[1].split()) + "]", formatted))
