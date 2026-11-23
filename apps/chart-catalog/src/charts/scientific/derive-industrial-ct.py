# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.3.5", "pillow==12.0.0", "scipy==1.16.3"]
# ///

"""Rebuild the Sample 2 cobalt-chromium XCT fixture from NIST 10.18434/M32162.

Download set1sample2segmented.zip from the dataset's segmented directory. For the
raw reconstructed TIFFs, fetch the byte range that holds slices 0372–0435 from
set1sample2raw.zip in the raw directory, using an inclusive HTTP range:

    curl -fL --range 516419691-605226451 -o set1sample2raw.range \
        https://data.nist.gov/od/ds/ark:/88434/mds2-2162/raw/set1sample2raw.zip

    uv run derive-industrial-ct.py set1sample2raw.range set1sample2segmented.zip > industrial-ct-fixture.json
"""

import argparse
from base64 import b64encode
import hashlib
from io import BytesIO
import json
from pathlib import Path
from struct import Struct
from zipfile import ZipFile
from zlib import crc32, decompress

import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes, generate_binary_structure, label


# The NIST SHA-256 for the complete set1sample2raw.zip is
# e1501bb6ffa81444b06256c0d994cb9ad39f1fc623b32ec7fa48807fbf8ff030.
RAW_RANGE_SHA256 = "d6b25a39af59da27c8f5c79c1a42f9b8dbaafa9372c7de8cb6df063a84770de5"
SEGMENTED_SHA256 = "c1a7958e30de60421ea9a27ac429a66dce569f1f1daf26af1423f1b720d71310"
ZIP_LOCAL_HEADER = Struct("<4s5H3L2H")
START_X, START_Y, START_Z = (362, 518, 372)
SIDE = 64
PITCH_UM = 2.45
DISPLAY_LOW, DISPLAY_HIGH = (34000, 57000)
MIN_VOXELS = 25
CROP = np.s_[START_Y:START_Y + SIDE, START_X:START_X + SIDE]
SLICES = range(START_Z, START_Z + SIDE)


def checked_bytes(path, sha256):
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != sha256:
        raise ValueError(f"Unexpected SHA-256 for {path}.")
    return content


def tiff_array(content, bytes_per_pixel):
    with Image.open(BytesIO(content)) as image:
        pixels = np.array(image)
    if pixels.shape != (1010, 980) or pixels.dtype.kind != "u" or pixels.dtype.itemsize != bytes_per_pixel:
        raise ValueError("Unexpected size or bit depth for a NIST Sample 2 TIFF.")
    return pixels


def raw_crop(raw_member_span):
    crop = []
    offset = 0
    for z in SLICES:
        signature, _, flags, method, _, _, crc, compressed_size, size, name_size, extra_size = (
            ZIP_LOCAL_HEADER.unpack_from(raw_member_span, offset)
        )
        if signature != b"PK\x03\x04" or flags != 0 or method != 8:
            raise ValueError("Expected a deflated local ZIP member with a complete header.")
        name_start = offset + ZIP_LOCAL_HEADER.size
        name_end = name_start + name_size
        name = raw_member_span[name_start:name_end].decode("utf-8")
        if name != f"set1sample2raw/set1sample2raw_{z:04d}.tif":
            raise ValueError(f"Unexpected slice name in reconstructed archive span: {name}.")
        data_start = name_end + extra_size
        offset = data_start + compressed_size
        tiff = decompress(memoryview(raw_member_span)[data_start:offset], wbits=-15)
        if len(tiff) != size or crc32(tiff) != crc:
            raise ValueError(f"ZIP integrity check failed for {name}.")
        crop.append(tiff_array(tiff, 2)[CROP].astype(np.uint16))
    if offset != len(raw_member_span):
        raise ValueError("The input span must end immediately after the final slice member.")
    return np.stack(crop)


def pore_mask(segmented_zip):
    crop = []
    with ZipFile(BytesIO(segmented_zip)) as archive:
        for z in SLICES:
            name = f"set1sample2segmented/set1sample2segmented_{z:04d}.tif"
            pixels = tiff_array(archive.read(name), 1)
            if np.any((pixels != 0) & (pixels != 255)):
                raise ValueError(f"Unexpected values in attributed binary mask {name}.")
            solid = pixels == 255
            if not np.all(binary_fill_holes(solid)[CROP]):
                raise ValueError(f"The crop intersects exterior air in {name}.")
            crop.append(~solid[CROP])
    return np.stack(crop)


def pore_labels(mask):
    connected, _ = label(mask, structure=generate_binary_structure(3, 1))
    faces = np.concatenate([connected[0].ravel(), connected[-1].ravel(), connected[:, 0].ravel(),
                            connected[:, -1].ravel(), connected[:, :, 0].ravel(), connected[:, :, -1].ravel()])
    boundary = set(np.unique(faces))
    counts = np.bincount(connected.ravel())
    # Preserve native voxels of enclosed components. Label the largest component first.
    kept = sorted((i for i in range(1, len(counts)) if counts[i] >= MIN_VOXELS and i not in boundary),
                  key=lambda i: (-counts[i], i))
    if [counts[i] for i in kept] != [959, 423, 305, 182]:
        raise ValueError("Unexpected pore components in the pinned crop.")
    lookup = np.zeros(len(counts), dtype=np.uint8)
    lookup[kept] = np.arange(1, len(kept) + 1)
    return lookup[connected]


def fixture(raw_path, segmented_path):
    raw = raw_crop(checked_bytes(raw_path, RAW_RANGE_SHA256))
    labels = pore_labels(pore_mask(checked_bytes(segmented_path, SEGMENTED_SHA256)))
    width = DISPLAY_HIGH - DISPLAY_LOW
    relative = np.clip(raw.astype(np.int32), DISPLAY_LOW, DISPLAY_HIGH) - DISPLAY_LOW
    gray = ((relative * 255 + width // 2) // width).astype(np.uint8)
    # C-order flattening of (z, y, x) arrays makes x the fastest-varying index.
    return {
        "dimensions": [SIDE] * 3,
        "spacingUm": [PITCH_UM] * 3,
        "originMm": [round(index * PITCH_UM / 1000, 6) for index in (START_X, START_Y, START_Z)],
        "grayBase64": b64encode(gray.tobytes(order="C")).decode("ascii"),
        "labelsBase64": b64encode(labels.tobytes(order="C")).decode("ascii"),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw_range", type=Path)
    parser.add_argument("segmented_zip", type=Path)
    args = parser.parse_args()
    print(json.dumps(fixture(args.raw_range, args.segmented_zip), indent=2))
