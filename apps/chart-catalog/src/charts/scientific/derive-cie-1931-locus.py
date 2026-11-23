"""Extract the CC BY-SA 4.0 CIE 1931 2° locus table into the catalog data file.

Download CIE_cc_1931_2deg.csv from https://doi.org/10.25039/CIE.DS.mifmy4x4.
Run python3 derive-cie-1931-locus.py CIE_cc_1931_2deg.csv > cie-1931-locus.json.
"""

import argparse
import csv
import hashlib
import json
from pathlib import Path


SOURCE_SHA256 = "5a3f0582ea0907867c7a2718051bbdc04f39e758d8c09e628930efc62386e399"


def extract(path):
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != SOURCE_SHA256:
        raise ValueError("Input bytes do not match the published CIE dataset checksum.")

    source = {
        "title": "CIE 1931 chromaticity coordinates of spectrum loci, 2 degree observer",
        "creator": "International Commission on Illumination (CIE), Vienna, 2019",
        "doi": "10.25039/CIE.DS.mifmy4x4",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "changes": "Extracted wavelength, x and y from the CIE CSV. All 471 rows and their original x and y values are retained.",
    }
    rows = list(csv.reader(content.decode("ascii").splitlines()))
    if [int(row[0]) for row in rows] != list(range(360, 831)):
        raise ValueError("Expected matching 1 nm wavelength samples from 360 through 830 nm.")
    lines = ["{", f'  "source": {json.dumps(source)},', '  "samples": [']
    lines.append(",\n".join(f"    [{wavelength}, {x}, {y}]" for wavelength, x, y, _ in rows))
    lines.extend(["  ]", "}"])
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_csv", type=Path)
    print(extract(parser.parse_args().source_csv))
