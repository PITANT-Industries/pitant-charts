#!/usr/bin/env python3
"""Extract the measured cumulative-flow fixture from Figshare v6.

Usage:
    python3 apps/chart-catalog/scripts/extract-cumulative-flow.py \
        "/path/to/Cleaned Event Log.zip" > /tmp/cumulative-flow-fixture.ts

The script also accepts the extracted MainProcess.xes file. Get the source
archive from https://doi.org/10.6084/m9.figshare.20130794.v6; only
Cleaned Event Log/MainProcess.xes is used.
"""
import argparse
from collections.abc import Sequence
from datetime import datetime
import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

MEMBER = "Cleaned Event Log/MainProcess.xes"
MAIN_PROCESS_SHA256 = "d89a1ae01c34512fc38d3022e7a61a35e98456e72e4e68175befcb797bdf5770"
NS = {"xes": "http://www.xes-standard.org/"}
ORIGIN = datetime.fromisoformat("2021-06-25T14:24:00")
LAST_RELEASE = datetime.fromisoformat("2021-06-25T15:46:00")
STAGES = (
    ("unload-queue", "Storage unload queue", "/hbw/unload", "scheduled"),
    ("material-prep", "Preparation and transfer", "/hbw/unload", "start"),
    ("oven", "Oven treatment", "/ov/burn", "start"),
    ("finishing", "Finishing and transfer", "/ov/burn", "complete"),
    ("inspection-storage", "Inspection and storage", "/hw/human_review", "scheduled"),
)
TERMINAL_BOUNDARY = ("/hbw/store", "complete")
CAPTION = (
    "University of Trier physical smart-factory demonstrator, 25 June 2021. "
    "The chart follows 21 jobs from the 30 released during 14:24–15:46 on "
    "the log clock that had all required boundaries and successful final storage. "
    "Queue entry and exit use the storage unload service’s scheduled and start "
    "events. The other bands group work and transfers between documented "
    "boundaries. Values describe this cohort."
)


def read_log(path: Path) -> ET.Element:
    if path.suffix.lower() == ".zip":
        with ZipFile(path) as archive:
            contents = archive.read(MEMBER)
    else:
        contents = path.read_bytes()
    if hashlib.sha256(contents).hexdigest() != MAIN_PROCESS_SHA256:
        raise ValueError("MainProcess.xes must match the published Figshare v6 cleaned log.")
    return ET.fromstring(contents)


def extract_events(root: ET.Element) -> list[tuple[float, str, str | None]]:
    selected: list[tuple[datetime, int, str, str | None]] = []
    source_count = 0
    included = 0
    rules = [(activity, lifecycle) for _, _, activity, lifecycle in STAGES] + [TERMINAL_BOUNDARY]

    for trace_index, trace in enumerate(root.findall("xes:trace", NS)):
        trace_name = trace.find("xes:string[@key='concept:name']", NS)
        if trace_name is None:
            raise ValueError("A trace is missing its XES case ID.")
        job_id = trace_name.attrib["value"]
        rows = [
            {child.get("key"): child.attrib["value"] for child in node if "value" in child.attrib}
            for node in trace.findall("xes:event", NS)
        ]
        timestamps = [datetime.fromisoformat(row["time:timestamp"]) for row in rows]
        first, last = min(timestamps), max(timestamps)
        if not ORIGIN <= first < LAST_RELEASE:
            continue
        source_count += 1

        matches = [
            [
                (time, row["lifecycle:state"])
                for time, row in zip(timestamps, rows)
                if (row["concept:name"], row["lifecycle:transition"]) == rule
            ]
            for rule in rules
        ]
        if not all(len(boundary) == 1 for boundary in matches):
            continue
        times, states = zip(*(boundary[0] for boundary in matches))
        if states[3] != "success" or states[-1] != "success":
            continue
        if times[0] != first or times[-1] != last:
            continue
        if any(left >= right for left, right in zip(times, times[1:])):
            continue

        included += 1
        stage_ids = [stage for stage, _, _, _ in STAGES] + [None]
        selected.extend((time, trace_index, job_id, stage) for time, stage in zip(times, stage_ids))

    if (source_count, included) != (30, 21):
        raise ValueError(f"Unexpected number of source or selected cases: {source_count}, {included}.")
    selected.sort(key=lambda row: (row[0], row[1]))
    return [((time - ORIGIN).total_seconds(), job_id, stage) for time, _, job_id, stage in selected]


def queue_peak_time(events: Sequence[tuple[float, str, str | None]]) -> float:
    queued: set[str] = set()
    peak = 0
    peak_time = 0.0
    for time, job_id, stage in events:
        if stage == "unload-queue":
            queued.add(job_id)
        else:
            queued.discard(job_id)
        if len(queued) > peak:
            peak, peak_time = len(queued), time
    if peak != 6:
        raise ValueError(f"Expected six queued jobs at the initial snapshot, observed {peak}.")
    return peak_time


def as_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def emit(events: Sequence[tuple[float, str, str | None]]) -> None:
    print("import type { CumulativeFlowData } from './model'")
    print()
    print("// Generated by scripts/extract-cumulative-flow.py from the published cleaned XES.")
    print("const recordedBoundaries: readonly [time: number, jobId: string, stage: string | null][] = [")
    for entry in events:
        print(f"  {as_json(entry)},")
    print("]")
    print()
    print("export const measuredCumulativeFlow: CumulativeFlowData = {")
    print("  start: 0,")
    print(f"  end: {as_json(events[-1][0])},")
    print("  stages: [")
    for stage, label, _, _ in STAGES:
        print(f"    {{ id: {as_json(stage)}, label: {as_json(label)} }},")
    print("  ],")
    print("  events: recordedBoundaries.map(([time, jobId, stage]) => ({ time, jobId, stage })),")
    print("}")
    print()
    print(f"export const cumulativeFlowInitialTime = {as_json(queue_peak_time(events))}")
    print('export const cumulativeFlowInitialStage = "unload-queue"')
    print()
    print("export const cumulativeFlowSource = {")
    fields = {
        "title": "An IoT-Enriched Event Log for Process Mining in Smart Factories",
        "url": "https://doi.org/10.6084/m9.figshare.20130794.v6",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "caption": CAPTION,
    }
    for key, value in fields.items():
        print(f"  {key}: {as_json(value)},")
    print("}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    emit(extract_events(read_log(args.source)))


if __name__ == "__main__":
    main()
