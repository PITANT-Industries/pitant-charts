"""Extract a lossless Cuprite reflectance crop from the NASA/JPL archive.

Download cuprite.95.cal.rtgc.v and cuprite.95.cal.rtgc.v.hdr from
https://popo.jpl.nasa.gov/1995_cuprite_RTGC_rfl_cube/.
Run with Python 3.11+ and NumPy 2.x:
    python3 derive-hyperspectral-cuprite.py cuprite.95.cal.rtgc.v \
        cuprite.95.cal.rtgc.v.hdr > hyperspectral-cuprite.json
"""

import argparse
import base64
import hashlib
import json
import re
import textwrap
from decimal import Decimal
from pathlib import Path

import numpy as np


CUBE_SHA256 = "7aaecb970304f004a08557e6cc1f9ea782a8d41a18ee0b2bf9f09d38e73a2707"
HEADER_SHA256 = "6f4c44a5ed14134e4a577456dd292d6bb42c6f1c06aeae1a348ba3800191b77e"
ARCHIVE_URL = "https://popo.jpl.nasa.gov/1995_cuprite_RTGC_rfl_cube/"
DATA_POLICY = "https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance"
CALIBRATION_URL = "https://aviris.jpl.nasa.gov/proceedings/workshops/02_docs/2002_Clark_web.pdf"
WIDTH, HEIGHT = 108, 84
COLUMN_ORIGIN, ROW_ORIGIN, PIXEL_STRIDE = 161, 409, 3
VISIBLE_CENTERS = (460.99, 559.07, 657.49)
MASKED_CENTERS = (1361.94, 1391.82, 1421.70, 1849.71, 1879.90, 1900.00, 1930.14, 1970.28)
RGB_CENTERS = (2270.05, 2210.28, 2090.47)
INITIAL_PIXEL = (85, 39)
INITIAL_CENTER = 2210.28


def checked_source(path, expected_hash):
    with path.open("rb") as source:
        checksum = hashlib.file_digest(source, "sha256").hexdigest()
    if checksum != expected_hash:
        raise ValueError(f"Unexpected SHA-256 for {path}: {checksum}")


def cube_metadata(header_path):
    header = header_path.read_text(encoding="ascii")
    fields = dict(re.findall(r"^([\w ]+?)\s*=\s*(\d+|bil)\s*$", header, re.M))
    if (fields["data type"], fields["interleave"], fields["byte order"]) != ("2", "bil", "0"):
        raise ValueError("Expected signed 16-bit little-endian ENVI BIL.")
    shape = tuple(int(fields[key]) for key in ("lines", "bands", "samples"))
    centers_um = re.search(r"wavelength\s*=\s*\{([^}]+)\}", header)[1]
    centers_nm = [float(Decimal(text.strip()) * 1000) for text in centers_um.split(",")]
    if len(centers_nm) != shape[1] or len(set(centers_nm)) != shape[1]:
        raise ValueError("Expected distinct wavelength centers for all source bands.")
    return shape, int(fields["header offset"]), np.asarray(centers_nm)


def extract(cube_path, header_path):
    checked_source(cube_path, CUBE_SHA256)
    checked_source(header_path, HEADER_SHA256)
    shape, offset, centers = cube_metadata(header_path)
    order = np.argsort(centers)
    wavelengths = centers[order]
    # Keep the full 2,050–2,400 nm mineral-feature interval. Save every second
    # sorted band outside it, plus the visible color channels and upper endpoint.
    primary = ((np.arange(len(wavelengths)) % 2 == 0)
               | ((2050 <= wavelengths) & (wavelengths <= 2400))
               | np.isin(wavelengths, (*VISIBLE_CENTERS, wavelengths[-1])))
    # Leave explicit gaps in the spectral trace at the low-signal water bands.
    # Keep representative measured planes as masked samples without altering DN.
    water = (((1360 <= wavelengths) & (wavelengths <= 1455))
             | ((1825 <= wavelengths) & (wavelengths <= 1975)))
    mask_planes = np.isin(wavelengths, MASKED_CENTERS)
    keep = (primary & ~water) | mask_planes
    source_bands = order[keep]
    wavelengths_nm = wavelengths[keep].tolist()
    data = np.memmap(cube_path, dtype="<i2", mode="r", offset=offset, shape=shape)
    rows = slice(ROW_ORIGIN, ROW_ORIGIN + HEIGHT * PIXEL_STRIDE, PIXEL_STRIDE)
    columns = slice(COLUMN_ORIGIN, COLUMN_ORIGIN + WIDTH * PIXEL_STRIDE, PIXEL_STRIDE)
    crop = data[rows, :, columns].transpose(1, 0, 2)[source_bands]
    if crop.shape != (len(wavelengths_nm), HEIGHT, WIDTH):
        raise ValueError("Crop does not have the expected dimensions.")

    # Each little-endian signed-16 delta is relative to the previous band at
    # the same pixel. Modulo-65536 arithmetic preserves every original count.
    deltas = np.diff(crop, axis=0, prepend=0).astype("<i2")
    encoded = base64.b64encode(deltas.tobytes()).decode("ascii")
    return {
        "source": {
            "label": "1995 Cuprite AVIRIS reflectance cube",
            "href": ARCHIVE_URL,
            "credit": "Courtesy NASA/JPL-Caltech. Surface reflectance calibration by USGS.",
            "license": "CC0 1.0",
            "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
            "policyUrl": DATA_POLICY,
            "calibrationUrl": CALIBRATION_URL,
            "binarySha256": CUBE_SHA256,
            "headerSha256": HEADER_SHA256,
        },
        "width": WIDTH,
        "height": HEIGHT,
        "columnOrigin": COLUMN_ORIGIN,
        "rowOrigin": ROW_ORIGIN,
        "pixelStride": PIXEL_STRIDE,
        "wavelengthsNm": wavelengths_nm,
        "sourceBandNumbers": (source_bands + 1).tolist(),
        "excludedBands": np.flatnonzero(mask_planes[keep]).tolist(),
        "valueScale": 0.005,
        "noDataValue": -32767,
        "displayRange": [19, 40],
        "initialBand": wavelengths_nm.index(INITIAL_CENTER),
        "initialPixel": INITIAL_PIXEL,
        "rgbBands": [wavelengths_nm.index(center) for center in RGB_CENTERS],
        "deltaBase64": textwrap.wrap(encoded, width=16384),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cube", type=Path)
    parser.add_argument("header", type=Path)
    args = parser.parse_args()
    print(json.dumps(extract(args.cube, args.header), indent=2))
