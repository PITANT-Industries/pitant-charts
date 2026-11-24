# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.5", "scipy==1.18.1"]
# ///

"""Rebuild the scalogram fixture from the published I-A-1.mat recording.

Download I-A-1.mat from https://data.mendeley.com/datasets/v43hmbwxpm/2.
Recreate both the JSON fixture and the lossless original waveform asset with:
uv run derive-wavelet-fixture.py path/to/I-A-1.mat \
  --original-waveform wavelet-original-waveform.bin > wavelet-fixture.json
"""

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from scipy.signal import fftconvolve, resample_poly


SOURCE = {
    "label": "Huan Huang and Natalie Baddour, University of Ottawa",
    "href": "https://doi.org/10.17632/v43hmbwxpm.2",
    "description": (
        "Measured inner-race bearing run-up, recording I-A-1. The original "
        "200 kHz accelerometer excerpt covers 3.50–6.06 seconds in published channel units."
    ),
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
}

RECORDING = {
    "filename": "I-A-1.mat",
    "fileId": "92bd5694-07ff-4b89-8b9b-5fc20f12954d",
    "sha256": "496a14c3caf62d28169ff2567e9aaf5c7913c03c648ad73651b410cd09316ea7",
    "channel": "Channel_1",
    "companionPaper": "https://doi.org/10.1016/j.dib.2018.11.019",
}

ORIGINAL_RATE_HZ = 200_000
DECIMATION = 16
SAMPLE_RATE_HZ = ORIGINAL_RATE_HZ // DECIMATION
START_ORIGINAL_SAMPLE = 700_000
END_ORIGINAL_SAMPLE = 1_212_000
START_SECONDS = START_ORIGINAL_SAMPLE / ORIGINAL_RATE_HZ
TIME_BIN_SAMPLES = 50
OMEGA_0 = 6
FOURIER_FACTOR = 4 * np.pi / (OMEGA_0 + np.sqrt(2 + OMEGA_0 ** 2))
POWER_MIN_DB = -60


def read_recording(path):
    with path.open("rb") as mat_file:
        if hashlib.file_digest(mat_file, "sha256").hexdigest() != RECORDING["sha256"]:
            raise ValueError(f"{path.name} does not match the expected recording hash.")
        mat_file.seek(0)
        samples = loadmat(mat_file, variable_names=[RECORDING["channel"]], squeeze_me=True)[RECORDING["channel"]]

    if samples.shape != (10 * ORIGINAL_RATE_HZ,) or not np.isfinite(samples).all():
        raise ValueError("Unexpected acceleration samples in I-A-1.mat.")
    return samples


def normalized_waveform(samples):
    filtered = resample_poly(samples, 1, DECIMATION, window=("kaiser", 5.0))
    segment = filtered[START_ORIGINAL_SAMPLE // DECIMATION:END_ORIGINAL_SAMPLE // DECIMATION]
    centered = segment - segment.mean()
    return centered / np.sqrt(np.mean(centered ** 2))


def write_original_waveform(samples, path):
    dictionary, indexes = np.unique(samples, return_inverse=True)
    if dictionary.size > 65_536:
        raise ValueError("Original waveform dictionary exceeds the uint16 index format.")
    if not np.array_equal(dictionary[indexes].view("u8"), samples.view("u8")):
        raise ValueError("Original waveform values did not round-trip exactly.")

    # Byte planes improve gzip compression without changing any source values.
    low = (indexes & 0xFF).astype("uint8")
    high = (indexes >> 8).astype("uint8")
    with path.open("wb") as target:
        with gzip.GzipFile(filename="", fileobj=target, mode="wb", mtime=0) as stream:
            stream.write(dictionary.size.to_bytes(4, "little"))
            stream.write(dictionary.astype("<f8").tobytes())
            stream.write(low.tobytes())
            stream.write(high.tobytes())


def morlet_power(waveform, scale_samples):
    radius = int(np.ceil(8 * scale_samples))
    position = np.arange(-radius, radius + 1) / scale_samples
    # The correction removes the small DC term. Normalize the discrete kernel to unit energy.
    wavelet = (np.exp(1j * OMEGA_0 * position) - np.exp(-OMEGA_0 ** 2 / 2)) * np.exp(-position ** 2 / 2)
    kernel = np.conjugate(wavelet[::-1]) / np.linalg.norm(wavelet)
    coefficients = fftconvolve(waveform, kernel, mode="same")
    return np.abs(coefficients) ** 2


def derive(path, original_waveform_path=None):
    samples = read_recording(path)
    original = samples[START_ORIGINAL_SAMPLE:END_ORIGINAL_SAMPLE]
    waveform = normalized_waveform(samples)
    frequency_hz = np.geomspace(30, 3_000, 100)
    scale_seconds = 1 / (frequency_hz * FOURIER_FACTOR)
    time_count = waveform.size // TIME_BIN_SAMPLES
    time_seconds = START_SECONDS + (np.arange(time_count) + 0.5) * TIME_BIN_SAMPLES / SAMPLE_RATE_HZ

    power = np.array([
        morlet_power(waveform, scale * SAMPLE_RATE_HZ).reshape(time_count, TIME_BIN_SAMPLES).max(axis=1)
        for scale in scale_seconds
    ])
    relative_power = np.maximum(power / power.max(), 10 ** (POWER_MIN_DB / 10))
    power_db = 10 * np.log10(relative_power)
    power_u8 = np.rint(255 * (power_db - POWER_MIN_DB) / -POWER_MIN_DB).astype("uint8")

    # Start at the strongest high-frequency transient away from the window edges.
    high_band = np.flatnonzero(frequency_hz >= 1_100)
    interior = np.flatnonzero((time_seconds > time_seconds[0] + 0.1) & (time_seconds < time_seconds[-1] - 0.1))
    inspection_power = power[np.ix_(high_band, interior)]
    high_row, time_column = np.unravel_index(np.argmax(inspection_power), inspection_power.shape)

    waveform_scale = float(np.max(np.abs(waveform)) / np.iinfo(np.int16).max)
    waveform_i16 = np.rint(waveform / waveform_scale).astype("<i2")
    if original_waveform_path is not None:
        write_original_waveform(original, original_waveform_path)
    return {
        "source": SOURCE,
        "recording": RECORDING,
        "processing": {
            "originalSampleRateHz": ORIGINAL_RATE_HZ,
            "originalStartSample": START_ORIGINAL_SAMPLE,
            "originalEndSampleExclusive": END_ORIGINAL_SAMPLE,
            "resampling": "Full recording resampled 1:16 with a centered Kaiser FIR (beta 5), then excerpted.",
            "normalization": "Subtract the excerpt mean and divide by the excerpt RMS.",
            "wavelet": "Complex Morlet with omega0 = 6, DC correction, and a discrete unit-energy kernel.",
            "methodReference": "https://doi.org/10/bhbwhf",
            "fourierFactor": float(FOURIER_FACTOR),
            "edgeTreatment": "Linear convolution with zeroes outside the excerpt, kernel truncated at ±8 scale radii.",
            "timeBinSeconds": TIME_BIN_SAMPLES / SAMPLE_RATE_HZ,
            "timeBinAggregation": "Maximum of the squared coefficient magnitudes within each time bin.",
            "powerReference": "10 log10(power / peak retained power), clipped at -60 dB.",
            "powerEncoding": "Unsigned 8-bit samples, rows in ascending frequency order, time fastest.",
            "waveformEncoding": "Little-endian signed int16 samples, in time order.",
            "originalWaveformEncoding": (
                "Gzip stream containing a uint32 little-endian dictionary length, "
                "a float64 little-endian dictionary, then the low and high byte planes of uint16 sample indices."
            ),
        },
        "timeSeconds": np.round(time_seconds, 6).tolist(),
        "frequencyHz": np.round(frequency_hz, 8).tolist(),
        "powerBase64": base64.b64encode(power_u8.tobytes()).decode("ascii"),
        "powerMinDb": POWER_MIN_DB,
        "powerMaxDb": 0,
        "coiEdgeSeconds": np.round(np.sqrt(2) * scale_seconds, 9).tolist(),
        "waveform": {
            "startSeconds": START_SECONDS,
            "sampleRateHz": SAMPLE_RATE_HZ,
            "unit": "× segment RMS",
            "samplesBase64": base64.b64encode(waveform_i16.tobytes()).decode("ascii"),
            "scale": waveform_scale,
        },
        "originalWaveform": {
            "startSeconds": START_SECONDS,
            "sampleRateHz": ORIGINAL_RATE_HZ,
            "unit": "channel units",
            "length": original.size,
        },
        "initialTimeSeconds": round(float(time_seconds[interior[time_column]]), 6),
        "initialFrequencyHz": round(float(frequency_hz[high_band[high_row]]), 8),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recording", type=Path, help="Published I-A-1.mat file")
    parser.add_argument("--original-waveform", type=Path, help="Write the compressed original waveform asset to this path")
    args = parser.parse_args()
    print(json.dumps(derive(args.recording, args.original_waveform), indent=2, ensure_ascii=False, allow_nan=False))
