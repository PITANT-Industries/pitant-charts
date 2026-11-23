"""Rebuild cms-dimuon-bins.json from the official MuRun2010B.csv file.

Run python3 derive-cms-spectrum.py path/to/MuRun2010B.csv > cms-dimuon-bins.json.
"""
import argparse
import csv
import hashlib
import json
import math
import zlib
from bisect import bisect_right
from pathlib import Path


SOURCE = {
    "title": "CMS Run2010B dimuon events",
    "citation": "McCauley, Thomas (2014), CERN Open Data Portal",
    "doi": "10.7483/OPENDATA.CMS.CB8H.MFFA",
    "url": "https://opendata.cern.ch/record/700",
    "csv": "https://opendata.cern.ch/record/700/files/MuRun2010B.csv",
    "license": "CC0-1.0",
    "csvBytes": 15_164_517,
    "csvAdler32": "19050705",
    "csvSha256": "47d09d16c01db9a45ce349c9730f032fdd22bf27980ecf524e7fb1fd84572cdb",
}


def histogram(path):
    content = path.read_bytes()
    if (
        len(content) != SOURCE["csvBytes"]
        or format(zlib.adler32(content), "08x") != SOURCE["csvAdler32"]
        or hashlib.sha256(content).hexdigest() != SOURCE["csvSha256"]
    ):
        raise ValueError("Expected the main CERN record 700 MuRun2010B.csv file.")

    minimum, maximum, bin_count = 2, 110, 240
    edges = [minimum * (maximum / minimum) ** (index / bin_count) for index in range(bin_count + 1)]
    bins = [0] * bin_count
    events = set()
    observed_minimum, observed_maximum = math.inf, -math.inf
    with path.open(newline="", encoding="utf-8") as csv_file:
        for row in csv.DictReader(csv_file):
            event = (row["Run"], row["Event"])
            mass = float(row["M"])
            if event in events or not math.isfinite(mass) or not minimum <= mass <= maximum:
                raise ValueError(f"Unexpected event or mass at {event}: {mass}")
            events.add(event)
            observed_minimum = min(observed_minimum, mass)
            observed_maximum = max(observed_maximum, mass)
            index = min(bin_count - 1, bisect_right(edges, mass) - 1)
            bins[index] += 1

    if len(events) != 100_000 or sum(bins) != len(events) or min(bins) <= 0:
        raise ValueError("Unexpected number of events or empty logarithmic bins.")
    return {
        "source": SOURCE,
        "eventCount": len(events),
        "observedMassRangeGeV": [observed_minimum, observed_maximum],
        "binning": {
            "minimumGeV": minimum,
            "maximumGeV": maximum,
            "scale": "logarithmic",
            "method": "Count every CSV M value once. Edges are lower-inclusive, upper-exclusive, with the last edge included.",
        },
        "counts": bins,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    print(json.dumps(histogram(parser.parse_args().csv), indent=2))
