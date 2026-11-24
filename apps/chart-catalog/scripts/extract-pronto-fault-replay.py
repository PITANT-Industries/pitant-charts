#!/usr/bin/env python3
"""Generate the fault replay fixture from the official PRONTO dataset ZIP.

Download the archive from https://doi.org/10.5281/zenodo.1341583, then run:
    python3 scripts/extract-pronto-fault-replay.py /path/to/archive.zip \
      > src/charts/scientific/fault-replay/fixture.ts

The extraction uses only the Python standard library and three verified members.
"""

import argparse
import csv
import hashlib
import io
import json
import math
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile


ROOT = "PRONTO benchmark case study/"
TEST = "C1 Air Blockage/Test3/"
PROCESS = TEST + "Process Data/0907Testday2.csv"
ALARMS = TEST + "Alarms and Events/0907Testday2_AlmEvt.txt"
OPERATIONS = "Operation logs/Operation log.xlsx"
HASHES = {
    PROCESS: "3ec29fa2f83745e1934d251a5e98be52039fb06a34358b4d378c5dc4ffb4ba45",
    ALARMS: "4a4fc4059f89c81d8a2379617d90a5081a3b5e8c597e1f41860b390ffad3ae77",
    OPERATIONS: "36676c5e73b91b0d029e96643d7b3f9d7748df802c367fe785cee16734a2ab82",
}
START = datetime(2017, 9, 7, 14, 47)
END = datetime(2017, 9, 7, 15, 57)
STEP = 5
CHANNELS = (
    ("PT312/OUT.CV", "air-pressure", "Air delivery pressure", "barg"),
    ("FIC302/PID1/PV.CV", "air-flow", "Inlet-air flow feedback", "Sm³/h"),
    ("FIC302/PID1/OUT.CV", "controller-output", "Inlet-air controller output", "%"),
)
CHANGE_ROWS = (98, 107, 116, 124, 133, 142, 151, 161, 169)
NS = {"sheet": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def seconds(time):
    return round((time - START).total_seconds(), 3)


def verified_member(archive, name):
    data = archive.read(ROOT + name)
    if hashlib.sha256(data).hexdigest() != HASHES[name]:
        raise ValueError(f"Unexpected source contents in {name}")
    return data


def process_samples(data):
    reader = csv.reader(io.StringIO(data.decode("ascii")))
    next(reader)
    tags = next(reader)
    next(reader)
    indices = [tags.index(tag) for tag, *_ in CHANNELS]
    minute_rows = defaultdict(list)
    for row in reader:
        if not row or not row[0]:
            continue
        minute = datetime.strptime(row[0], "%m/%d/%Y %H:%M")
        if START <= minute <= END:
            values = [float(row[index]) for index in indices]
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f"Non-finite process value at {minute}")
            minute_rows[minute].append([round(value, 4) for value in values])

    samples = []
    minute = START
    while minute <= END:
        rows = minute_rows[minute]
        if len(rows) != 60:
            raise ValueError(f"Expected 60 ordered process samples in {minute}, saw {len(rows)}")
        samples.extend(rows[::STEP] if minute < END else rows[:1])
        minute += timedelta(minutes=1)
    return samples


def operator_actions(data):
    with ZipFile(io.BytesIO(data)) as workbook:
        strings = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
        shared = ["".join(item.itertext()) for item in strings]
        sheet = ElementTree.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
    cells = {cell.attrib["r"]: cell for cell in sheet.findall(".//sheet:c", NS)}

    def value(ref):
        cell = cells[ref]
        text = cell.findtext("sheet:v", namespaces=NS)
        return shared[int(text)] if cell.attrib.get("t") == "s" else text

    actions = []
    intervals = []
    position = 90
    begins = 0
    for row in CHANGE_ROWS:
        if value(f"J{row}").strip() != "Manual valve V11:":
            raise ValueError(f"Unexpected operation at workbook row {row}")
        old, new = map(int, value(f"L{row}").split(" to "))
        if old != position:
            raise ValueError(f"Discontinuous valve position history at workbook row {row}")
        # The operator record contains times to whole minutes. Round Excel fractions accordingly.
        minute_of_day = round(float(value(f"K{row}")) * 1440)
        when = datetime.combine(START.date(), datetime.min.time()) + timedelta(minutes=minute_of_day)
        elapsed = int(seconds(when))
        if not begins < elapsed < seconds(END):
            raise ValueError(f"Unexpected operator timestamp at workbook row {row}")
        intervals.append(valve_state(begins, elapsed, position))
        actions.append({
            "id": f"v11-{row}",
            "label": f"V11 {old}° → {new}°",
            "time": elapsed,
            "detail": "Manual valve adjustment in the operation log, recorded to the minute.",
        })
        position = new
        begins = elapsed
    intervals.append(valve_state(begins, None, position))
    return actions, intervals


def valve_state(start, end, position):
    state = {
        "id": f"v11-state-{start}",
        "label": f"V11 at {position}°",
        "start": start,
        "detail": "Valve setting from the operation log.",
    }
    if end is not None:
        state["end"] = end
    return state


def alarm_intervals(data):
    reader = csv.DictReader(io.StringIO(data.decode("ascii")), delimiter="\t")
    pending = {}
    intervals = []
    for row in reversed(list(reader)):
        if row["Event Type"] != "ALARM":
            continue
        when = datetime.strptime(row["Date/Time*"], "%m/%d/%Y %I:%M:%S.%f %p")
        elapsed = seconds(when)
        key = (row["Module"], row["Parameter"])
        if row["State"].startswith("ACT/") and key not in pending:
            pending[key] = {
                "id": f"{row['Module'].lower()}-{row['']}",
                "label": f"{row['Module']} module alarm",
                "start": elapsed,
                "detail": f"{row['Level'].split('-', 1)[-1].title()} instrument alarm. {row['Desc2']}.",
            }
        elif row["State"].startswith("INACT/") and key in pending:
            interval = pending.pop(key)
            interval["end"] = elapsed
            intervals.append(interval)
    limit = int(seconds(END))
    selected = []
    for interval in [*intervals, *pending.values()]:
        if interval["start"] >= limit or interval.get("end", limit) <= 0:
            continue
        # Selected records all raise inside the display window.
        if interval["start"] < 0 or interval.get("end", limit) > limit:
            raise ValueError("Expected complete alarm records for the chosen window")
        selected.append(interval)
    return sorted(selected, key=lambda item: item["start"])


def as_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(", ", ": "))


def fixture(samples, states, alarms, actions):
    lines = [
        "import type { FaultReplayData } from './model'",
        "",
        "// PRONTO Test 3, 7 September 2017, 14:47–15:57 on the site log clock.",
        "// Regenerate with scripts/extract-pronto-fault-replay.py.",
        "// Air delivery pressure (barg), inlet-air flow feedback (Sm³/h), controller output (%).",
        "const readings: readonly (readonly [number, number, number])[] = [",
        *[f"  {as_json(row)}," for row in samples],
        "]",
        "",
        "const channels = [",
    ]
    lines.extend(f"  {as_json([name, label, unit])}," for _, name, label, unit in CHANNELS)
    lines.extend([
        "] as const",
        "",
        "export const prontoFaultReplay: FaultReplayData = {",
        "  start: 0,",
        f"  end: {int(seconds(END))},",
        "  signals: channels.map(([id, label, unit], index) => ({",
        "    id,",
        "    label,",
        "    unit,",
        f"    maxAge: {STEP},",
        f"    samples: readings.map((values, offset) => ({{ time: offset * {STEP}, value: values[index] }})),",
        "  })),",
    ])
    for key, records in [("states", states), ("alarms", alarms), ("actions", actions)]:
        lines.append(f"  {key}: [")
        lines.extend(f"    {as_json(record)}," for record in records)
        lines.append("  ],")
    lines.extend([
        "}",
        "",
        f"export const prontoReplayInitialTime = {actions[-2]['time']}",
        "",
        "export const prontoReplaySource = {",
        "  title: 'PRONTO heterogeneous benchmark dataset',",
        "  url: 'https://doi.org/10.5281/zenodo.1341583',",
        "  license: 'CC BY 4.0',",
        "  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',",
        "  caption: 'Cranfield multiphase flow facility, Test 3, 7 September 2017, 14:47–15:57 on the site log clock. Operators gradually narrowed V11 to reproduce an inlet air blockage. Each SCADA minute contains 60 rows. The replay derives seconds from row order and retains one in five readings. Manual valve settings come from the minute-resolution operation log. Module alarms are separately recorded instrument events.',",
        "}",
    ])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    with ZipFile(args.archive) as archive:
        samples = process_samples(verified_member(archive, PROCESS))
        alarms = alarm_intervals(verified_member(archive, ALARMS))
        actions, states = operator_actions(verified_member(archive, OPERATIONS))
    print(fixture(samples, states, alarms, actions))


if __name__ == "__main__":
    main()
