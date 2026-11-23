# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.5", "scipy==1.18.1"]
# ///

"""Rebuild the Campbell diagram fixture from two official Mendeley MAT files.

Download H-A-1.mat and I-A-1.mat from https://data.mendeley.com/datasets/v43hmbwxpm/2.
Run uv run derive-ottawa-campbell.py path/to/downloads > ottawa-campbell.json.
"""

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from scipy.io import loadmat


SOURCE = {
    "label": "Huan Huang and Natalie Baddour, University of Ottawa",
    "href": "https://doi.org/10.17632/v43hmbwxpm.2",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "description": (
        "Bearing Vibration Data under Time-varying Rotational Speed Conditions, "
        "version 2. Derived spectra from one healthy and one inner-race fault run."
    ),
    "published": "2019-02-06",
    "companionPaper": "https://doi.org/10.1016/j.dib.2018.11.019",
}

RECORDINGS = (
    {
        "id": "healthy",
        "label": "Healthy bearing",
        "filename": "H-A-1.mat",
        "fileId": "5aa2ec96-ba06-4b64-b6bf-92c805c90ac5",
        "sha256": "a113089dac7969eaf3e2adc563aa724a523f5d7ef4b3dd957bdf111ac1d84257",
    },
    {
        "id": "inner-race-fault",
        "label": "Inner-race fault",
        "filename": "I-A-1.mat",
        "fileId": "92bd5694-07ff-4b89-8b9b-5fc20f12954d",
        "sha256": "496a14c3caf62d28169ff2567e9aaf5c7913c03c648ad73651b410cd09316ea7",
    },
)

SAMPLE_RATE_HZ = 200_000
DURATION_SECONDS = 10
WINDOW_SECONDS = 0.25
WINDOW_SAMPLES = int(SAMPLE_RATE_HZ * WINDOW_SECONDS)
PULSES_PER_REVOLUTION = 1024
ENCODER_THRESHOLD_VOLTS = 2
MAX_FREQUENCY_HZ = 400
DISPLAY_FLOOR_DB = -80


def run_spectra(path, sha256, band, taper):
    with path.open("rb") as mat_file:
        if hashlib.file_digest(mat_file, "sha256").hexdigest() != sha256:
            raise ValueError(f"{path.name} does not match the published SHA-256.")
        mat_file.seek(0)
        recording = loadmat(mat_file, squeeze_me=True, variable_names=["Channel_1", "Channel_2"])

    acceleration = recording["Channel_1"]
    encoder = recording["Channel_2"]
    sample_count = SAMPLE_RATE_HZ * DURATION_SECONDS
    if acceleration.shape != (sample_count,) or encoder.shape != (sample_count,):
        raise ValueError(f"Unexpected channel length in {path.name}.")

    acceleration_windows = acceleration.reshape(-1, WINDOW_SAMPLES)
    centered_windows = acceleration_windows - acceleration_windows.mean(axis=1, keepdims=True)
    amplitude = 2 * np.abs(np.fft.rfft(centered_windows * taper, axis=1)[:, band]) / taper.sum()

    high = encoder >= ENCODER_THRESHOLD_VOLTS
    rising_edges = np.flatnonzero(~high[:-1] & high[1:]) + 1
    boundaries = np.arange(0, sample_count + 1, WINDOW_SAMPLES)
    edge_offsets = np.searchsorted(rising_edges, boundaries)
    pulse_counts = np.diff(edge_offsets) - 1
    if np.any(pulse_counts < 1):
        raise ValueError(f"Too few encoder edges to derive each window speed in {path.name}.")

    elapsed_samples = rising_edges[edge_offsets[1:] - 1] - rising_edges[edge_offsets[:-1]]
    measured_rpm = 60 * SAMPLE_RATE_HZ * pulse_counts / (PULSES_PER_REVOLUTION * elapsed_samples)
    order = np.argsort(measured_rpm, kind="stable")
    sorted_rpm = np.round(measured_rpm[order], 1)
    if np.any(np.diff(sorted_rpm) <= 0):
        raise ValueError(f"Expected distinct window speeds in {path.name}.")

    return sorted_rpm.tolist(), amplitude[order]


def derive(directory):
    all_frequencies = np.fft.rfftfreq(WINDOW_SAMPLES, d=1 / SAMPLE_RATE_HZ)
    band = (all_frequencies > 0) & (all_frequencies <= MAX_FREQUENCY_HZ)
    frequencies = all_frequencies[band].astype(int).tolist()
    taper = np.hanning(WINDOW_SAMPLES)
    derived = [
        run_spectra(directory / recording["filename"], recording["sha256"], band, taper)
        for recording in RECORDINGS
    ]
    common_reference = max(amplitude.max() for _, amplitude in derived)
    amplitude_floor = common_reference * 10 ** (DISPLAY_FLOOR_DB / 20)

    runs = []
    for recording, (rpm, amplitude) in zip(RECORDINGS, derived, strict=True):
        levels_db = 20 * np.log10(np.maximum(amplitude, amplitude_floor) / common_reference)
        runs.append({
            "id": recording["id"],
            "label": recording["label"],
            "rpm": rpm,
            "levelsDb": np.round(levels_db, 1).tolist(),
        })

    return {
        "source": SOURCE,
        "recordings": RECORDINGS,
        "processing": {
            "sampleRateHz": SAMPLE_RATE_HZ,
            "durationSecondsPerRun": DURATION_SECONDS,
            "windowSeconds": WINDOW_SECONDS,
            "windowSamples": WINDOW_SAMPLES,
            "windowOverlapSamples": 0,
            "vibrationChannel": "Channel_1",
            "spectrum": "Remove each window mean, apply a Hann taper, then take its coherent-gain-corrected one-sided FFT amplitude.",
            "encoderChannel": "Channel_2",
            "pulsesPerRevolution": PULSES_PER_REVOLUTION,
            "encoderThresholdVolts": ENCODER_THRESHOLD_VOLTS,
            "speed": "Use the first and last rising encoder crossings in each window. Sort windows by measured RPM.",
            "reference": "20 log10 of amplitude relative to the largest displayed amplitude across both runs.",
            "amplitudeFloorDb": DISPLAY_FLOOR_DB,
        },
        "frequenciesHz": frequencies,
        "runs": runs,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory containing both published MAT files")
    formatted = json.dumps(derive(parser.parse_args().directory), indent=2, allow_nan=False)
    # Keep each numeric row on one line while retaining the surrounding structure.
    print(re.sub(r"\[([\s\d.,-]+)\]", lambda match: "[" + " ".join(match[1].split()) + "]", formatted))
