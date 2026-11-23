# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.5", "scipy==1.18.1"]
# ///

"""Rebuild the bearing envelope fixture from the original Mendeley MAT files.

Download H-A-1.mat and I-A-1.mat from https://data.mendeley.com/datasets/v43hmbwxpm/2.
Run uv run derive-envelope-fixture.py path/to/downloads > envelope-fixture.json.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re

import numpy as np
from scipy.io import loadmat
from scipy.signal import butter, hilbert, resample_poly, sosfiltfilt, welch


SOURCE = {
    "label": "Huan Huang and Natalie Baddour, University of Ottawa",
    "href": "https://doi.org/10.17632/v43hmbwxpm.2",
    "description": (
        "Measured healthy and inner-race fault bearing run-ups. Each spectrum uses "
        "60 encoder-measured shaft turns starting just after 3 seconds."
    ),
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "geometryReference": "https://doi.org/10.1016/j.dib.2018.11.019",
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

BANDS = (
    {"id": "low-carrier", "label": "0.8–1.6 kHz", "lowHz": 800, "highHz": 1_600},
    {"id": "mid-carrier", "label": "1.6–3.2 kHz", "lowHz": 1_600, "highHz": 3_200},
    {"id": "high-carrier", "label": "3.2–6.4 kHz", "lowHz": 3_200, "highHz": 6_400},
)

# ER16K geometry reported in Table 1 of the source paper.
REFERENCES = (
    {"id": "bpfo", "label": "BPFO", "order": 3.57},
    {"id": "bpfi", "label": "BPFI", "order": 5.43},
    {"id": "bpfi-harmonic-2", "label": "2× BPFI", "order": 10.86},
)

ORIGINAL_RATE_HZ = 200_000
DECIMATION = 10
SAMPLE_RATE_HZ = ORIGINAL_RATE_HZ // DECIMATION
ACCELERATION_CHANNEL = "Channel_1"
ENCODER_CHANNEL = "Channel_2"
PULSES_PER_TURN = 1_024
ENCODER_THRESHOLD_VOLTS = 2
WINDOW_START_SECONDS = 3
TURNS = 60
ANGLE_SAMPLES_PER_TURN = 128
ENVELOPE_CUTOFF_HZ = 450
WELCH_LENGTH = 1_024
WELCH_OVERLAP = WELCH_LENGTH // 2
PSD_MAX_HZ = 8_000
ORDER_MAX = 15
DISPLAY_FLOOR_DB = -65
DEFAULT_RUN = "inner-race-fault"
DEFAULT_BAND = "high-carrier"


def load_recording(path, sha256):
    with path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != sha256:
            raise ValueError(f"{path.name} does not match the expected recording hash.")
        stream.seek(0)
        channels = loadmat(stream, variable_names=[ACCELERATION_CHANNEL, ENCODER_CHANNEL], squeeze_me=True)
    acceleration, encoder = channels[ACCELERATION_CHANNEL], channels[ENCODER_CHANNEL]
    for channel in (acceleration, encoder):
        if channel.shape != (10 * ORIGINAL_RATE_HZ,) or not np.isfinite(channel).all():
            raise ValueError(f"Unexpected measurements in {path.name}.")
    return acceleration, encoder


def encoder_window(encoder):
    edges = np.flatnonzero((encoder[:-1] < ENCODER_THRESHOLD_VOLTS) & (encoder[1:] >= ENCODER_THRESHOLD_VOLTS))
    fractions = (ENCODER_THRESHOLD_VOLTS - encoder[edges]) / (encoder[edges + 1] - encoder[edges])
    crossing_seconds = (edges + fractions) / ORIGINAL_RATE_HZ
    first = np.searchsorted(crossing_seconds, WINDOW_START_SECONDS)
    selected = crossing_seconds[first:first + TURNS * PULSES_PER_TURN + 1]
    if selected.size != TURNS * PULSES_PER_TURN + 1:
        raise ValueError("The recording does not contain 60 complete turns in the requested window.")
    return selected


def run_spectra(directory, recording, frequency_mask, order_mask):
    acceleration, encoder = load_recording(directory / recording["filename"], recording["sha256"])
    filtered = resample_poly(acceleration, 1, DECIMATION, window=("kaiser", 5.0))
    time_seconds = np.arange(filtered.size) / SAMPLE_RATE_HZ
    window = encoder_window(encoder)
    start, stop = np.searchsorted(time_seconds, [window[0], window[-1]])
    turn_duration = np.diff(window[::PULSES_PER_TURN])
    if ENVELOPE_CUTOFF_HZ >= ANGLE_SAMPLES_PER_TURN / (2 * turn_duration.max()):
        raise ValueError("Insufficient angular sampling rate for the envelope filter.")

    _, psd = welch(
        filtered[start:stop], fs=SAMPLE_RATE_HZ, window="hann_periodic",
        nperseg=WELCH_LENGTH, noverlap=WELCH_OVERLAP, detrend="constant",
    )

    edge_stride = PULSES_PER_TURN // ANGLE_SAMPLES_PER_TURN
    angle_times = window[:-1:edge_stride]
    taper = np.hanning(angle_times.size + 1)[:-1]
    envelope_filter = butter(8, ENVELOPE_CUTOFF_HZ, fs=SAMPLE_RATE_HZ, output="sos")
    amplitude = {}
    for band in BANDS:
        carrier_filter = butter(
            4, (band["lowHz"], band["highHz"]), fs=SAMPLE_RATE_HZ, btype="bandpass", output="sos",
        )
        carrier = sosfiltfilt(carrier_filter, filtered)
        envelope = sosfiltfilt(envelope_filter, np.abs(hilbert(carrier)))
        angle_envelope = np.interp(angle_times, time_seconds, envelope)
        spectrum = 2 * np.abs(np.fft.rfft((angle_envelope - angle_envelope.mean()) * taper)) / taper.sum()
        amplitude[band["id"]] = spectrum[order_mask]

    return {
        "psd": psd[frequency_mask],
        "amplitude": amplitude,
        "window": {
            "startSeconds": round(float(window[0]), 9),
            "endSeconds": round(float(window[-1]), 9),
            "rpmMin": round(float(60 / turn_duration.max()), 1),
            "rpmMax": round(float(60 / turn_duration.min()), 1),
        },
    }


def relative_db(values, reference, multiplier):
    ratio = np.maximum(values / reference, 10 ** (DISPLAY_FLOOR_DB / multiplier))
    return np.round(multiplier * np.log10(ratio), 1).tolist()


def derive(directory):
    full_frequency = np.fft.rfftfreq(WELCH_LENGTH, d=1 / SAMPLE_RATE_HZ)
    full_orders = np.fft.rfftfreq(TURNS * ANGLE_SAMPLES_PER_TURN, d=1 / ANGLE_SAMPLES_PER_TURN)
    frequency_mask = (full_frequency > 0) & (full_frequency <= PSD_MAX_HZ)
    order_mask = (full_orders > 0) & (full_orders <= ORDER_MAX)
    spectra = [run_spectra(directory, recording, frequency_mask, order_mask) for recording in RECORDINGS]
    psd_reference = max(run["psd"].max() for run in spectra)
    amplitude_reference = max(values.max() for run in spectra for values in run["amplitude"].values())
    orders = np.round(full_orders[order_mask], 8)

    runs = []
    for recording, run in zip(RECORDINGS, spectra, strict=True):
        runs.append({
            "id": recording["id"],
            "label": recording["label"],
            "window": run["window"],
            "broadbandDb": relative_db(run["psd"], psd_reference, 10),
            "envelopes": {
                band: relative_db(values, amplitude_reference, 20)
                for band, values in run["amplitude"].items()
            },
        })
    default_spectra = next(run for recording, run in zip(RECORDINGS, spectra, strict=True) if recording["id"] == DEFAULT_RUN)
    return {
        "source": SOURCE,
        "recordings": RECORDINGS,
        "processing": {
            "originalSampleRateHz": ORIGINAL_RATE_HZ,
            "sampleRateHz": SAMPLE_RATE_HZ,
            "resampling": "Full vibration channel downsampled 1:10 with a centered Kaiser FIR (beta 5).",
            "vibrationChannel": ACCELERATION_CHANNEL,
            "encoderChannel": ENCODER_CHANNEL,
            "pulsesPerTurn": PULSES_PER_TURN,
            "encoderThresholdVolts": ENCODER_THRESHOLD_VOLTS,
            "turnsPerRun": TURNS,
            "samplesPerTurn": ANGLE_SAMPLES_PER_TURN,
            "window": "Start at first interpolated rising encoder crossing at or after 3 seconds and keep 60 shaft turns.",
            "broadband": "Welch density, 1024-sample periodic Hann, 512 overlap, segment means removed. 10 log10 relative to the joint maximum within the displayed band.",
            "envelope": "Zero-phase Butterworth bandpass (N=4 prototype), Hilbert magnitude, then 450 Hz zero-phase Butterworth low-pass (N=8). Interpolate onto every eighth encoder edge.",
            "orderSpectrum": "Remove envelope mean, apply periodic Hann, and take coherent-gain-corrected one-sided FFT amplitude. 20 log10 relative to the joint maximum across runs and carrier bands.",
            "displayFloorDb": DISPLAY_FLOOR_DB,
        },
        "frequencyHz": full_frequency[frequency_mask].tolist(),
        "orders": orders.tolist(),
        "bands": BANDS,
        "references": REFERENCES,
        "runs": runs,
        "initialBandId": DEFAULT_BAND,
        "initialRunId": DEFAULT_RUN,
        "initialOrder": float(orders[np.argmax(default_spectra["amplitude"][DEFAULT_BAND])]),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory containing both published MAT files")
    formatted = json.dumps(derive(parser.parse_args().directory), indent=2, ensure_ascii=False, allow_nan=False)
    print(re.sub(r"\[([\s\d.,-]+)\]", lambda match: "[" + " ".join(match[1].split()) + "]", formatted))
