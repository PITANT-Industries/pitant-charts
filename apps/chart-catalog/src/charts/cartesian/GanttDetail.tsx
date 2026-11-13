import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle } from "lucide-react";
import { usePlotSize } from "../usePlotSize";
import { dependencyPath, schedules, scheduleSkeleton, type ScheduleRow, type ScheduleVariant } from "./gantt-detail-data";
import "./gantt-detail.css";

const dayMilliseconds = 86_400_000;
const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

export function GanttDetail({ variant, label, compact = false }: { variant: ScheduleVariant; label: string; compact?: boolean }) {
  const id = useId();
  const canLoad = variant === "gantt-loading";
  const milestones = variant === "gantt-milestones";
  const roadmap = variant === "gantt-roadmap";
  const schedule = schedules[variant];
  const { rows, rowHeight, rowTop, minimum, maximum, radius } = schedule;
  const today = "today" in schedule ? schedule.today : undefined;
  const [loading, setLoading] = useState(canLoad);
  const [selected, setSelected] = useState<number | null>(null);
  const fullHeight = rowHeight * rows.length + rowTop + 36;
  const { plot, width, height } = usePlotSize<HTMLDivElement>(728, fullHeight);
  const top = compact ? 6 : rowTop;
  const bottom = compact ? height - 6 : fullHeight - 36;
  const left = compact ? 4 : Math.min(schedule.labelWidth, width - 44);
  const right = width - (compact ? 4 : 24);
  const timelineWidth = right - left;
  const step = (bottom - top) / rows.length;
  const barHeight = step * .56;
  const diamondRadius = barHeight * .42;
  const x = (day: number) => left + (day - minimum) * timelineWidth / (maximum - minimum);
  const y = (index: number) => top + step * (index + .5);
  const date = (day: number, format = shortDate) => format.format(schedule.origin + Math.round(day) * dayMilliseconds);
  const active = selected === null || loading ? undefined : rows[selected];
  const interactive = !loading && !compact;
  const ink = (row: ScheduleRow) => `var(--chart-${row.team === "Platform" ? 3 : milestones || row.team === "Mobile" ? 2 : 1})`;

  function readout(row: ScheduleRow): [string, string | number][] {
    if (roadmap) return [["Team", row.team ?? ""], ["Owner", row.owner ?? ""], ["Done", `${row.progress}%`]];
    const dependencies = row.dependencies.length ? [["After", row.dependencies.map(index => rows[index].name).join(", ")] as [string, string]] : [];
    if (row.start === row.end) return [["Date", date(row.start)], ...dependencies];
    return [
      ...(!milestones ? [["Progress", `${row.progress}%`] as [string, string]] : []),
      ["Start", date(row.start)], ["End", date(row.end)], ["Duration", `${Math.round(row.end - row.start)} days`],
      ...(row.taskCount ? [["Tasks", row.taskCount] as [string, number]] : []), ...dependencies,
    ];
  }

  function inspect(event: PointerEvent<SVGSVGElement>) {
    const { left: origin, top: offset } = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - origin;
    const pointerY = event.clientY - offset;
    const index = Math.floor((pointerY - top) / step);
    const row = rows[index];
    if (!row || pointerX < 0 || pointerX > right) { setSelected(null); return; }
    const markX = x(row.start);
    const markY = y(index);
    const withinLabel = pointerX < left;
    const withinMark = row.start === row.end
      ? Math.abs(pointerX - markX) + Math.abs(pointerY - markY) <= diamondRadius + 3
      : pointerX >= markX && pointerX <= x(row.end) && Math.abs(pointerY - markY) <= (row.taskCount ? 6 : barHeight / 2);
    setSelected(withinLabel || withinMark ? index : null);
  }

  function selectByKey(event: KeyboardEvent<SVGSVGElement>) {
    const end = rows.length - 1;
    if (event.key === "Escape" && selected !== null) {
      event.preventDefault();
      event.stopPropagation();
      setSelected(null);
      return;
    }
    const indices: Record<string, number> = {
      Home: 0, End: end, ArrowRight: Math.min(end, (selected ?? -1) + 1), ArrowDown: Math.min(end, (selected ?? -1) + 1),
      ArrowLeft: Math.max(0, (selected ?? 1) - 1), ArrowUp: Math.max(0, (selected ?? 1) - 1),
    };
    if (!Object.hasOwn(indices, event.key)) return;
    event.preventDefault();
    const index = indices[event.key];
    setSelected(index);
    const scroll = event.currentTarget.parentElement?.parentElement;
    if (!scroll || scroll.clientWidth >= width) return;
    const target = x(rows[index].start);
    if (target > scroll.scrollLeft + scroll.clientWidth - 16) scroll.scrollLeft = target - scroll.clientWidth * .55;
    if (target < scroll.scrollLeft + 16) scroll.scrollLeft = Math.max(0, target - scroll.clientWidth * .45);
  }

  const style = { "--gantt-min-width": `${schedule.minimumWidth}px`, "--gantt-height": `${fullHeight}px` } as CSSProperties;
  const hintX = active ? x(active.start) : 0;
  return <div className="gantt-detail" data-compact={compact} data-gantt-variant={variant} style={style}>
    {!compact && canLoad && <div className="gantt-controls"><Toggle pressed={loading} onPressedChange={pressed => { setLoading(pressed); setSelected(null); }}>
      <LoaderCircle size={14} aria-hidden="true" /> Loading
    </Toggle></div>}
    <div className="gantt-scroll">
      <div className="gantt-detail-plot" ref={plot}>
        <svg className="cartesian-focus-surface" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={label}
          aria-describedby={interactive ? id : undefined} aria-busy={loading || undefined} tabIndex={interactive ? 0 : undefined}
          onKeyDown={interactive ? selectByKey : undefined} onPointerMove={interactive ? inspect : undefined}
          onPointerDown={interactive ? inspect : undefined} onPointerLeave={event => { if (event.pointerType !== "touch") setSelected(null); }}
          onPointerCancel={() => setSelected(null)} onBlur={() => setSelected(null)}>
          {interactive && <desc id={id}>Use arrow keys to inspect rows. Home and End select the first and last rows. Escape clears the selection.</desc>}
          <g aria-hidden="true" stroke="var(--border)" strokeDasharray="4 4">
            {schedule.ticks.map(day => <line key={day} data-gantt-grid="" x1={x(day)} x2={x(day)} y1={top} y2={bottom} />)}
          </g>
          {loading ? <g className="gantt-skeleton" aria-hidden="true" fill="var(--muted-foreground)">
            {scheduleSkeleton.map((bar, index) => {
              const phase = Boolean(rows[index].taskCount);
              const h = phase ? 6.4512 : barHeight;
              return <g key={index}>
                {bar.width > 0 && <rect data-gantt-skeleton="bar" x={left + bar.x * timelineWidth} y={y(index) - h / 2}
                  width={bar.width * timelineWidth} height={h} rx={phase ? 2 : 6} fillOpacity={phase ? .32 : .45} />}
                {!compact && <rect data-gantt-skeleton="label" x={phase ? 14 : 26} y={y(index) - 4} width={bar.label} height={8} rx={4} fillOpacity={.32} />}
              </g>;
            })}
          </g> : <g aria-hidden="true" className={canLoad ? "gantt-reveal" : undefined}>
            {rows.map((row, index) => row.taskCount && <rect key={row.name} data-gantt-phase-background="" x={left} y={y(index) - step / 2}
              width={timelineWidth} height={step} fill="var(--muted)" />)}
            <g stroke="var(--muted-foreground)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" fill="none">
              {rows.flatMap((row, index) => row.dependencies.map(previous => {
                const parent = rows[previous];
                const from: [number, number] = [x(parent.end) + (parent.start === parent.end ? diamondRadius : 0), y(previous)];
                const to: [number, number] = [x(row.start) - 1 - (row.start === row.end ? diamondRadius : 0), y(index)];
                return <path key={`${previous}:${index}`} data-gantt-dependency="" d={dependencyPath(from, to, step)}
                  opacity={selected === null || selected === index || selected === previous ? 1 : .3} />;
              }))}
            </g>
            {rows.map((row, index) => {
              const start = x(row.start);
              const length = x(row.end) - start;
              const center = y(index);
              const phase = Boolean(row.taskCount);
              const color = ink(row);
              const phaseHeight = barHeight * .32;
              return <g key={row.name} data-gantt-row={row.name} opacity={selected === null || selected === index ? 1 : .38}>
                {row.start === row.end ? <path data-gantt-milestone="" d={`M${start},${center - diamondRadius}L${start + diamondRadius},${center}L${start},${center + diamondRadius}L${start - diamondRadius},${center}Z`}
                  fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /> : <>
                  <rect data-gantt-bar={phase ? "phase" : "task"} x={start} y={center - (phase ? phaseHeight : barHeight) / 2}
                    width={length} height={phase ? phaseHeight : barHeight} rx={phase ? 2 : radius}
                    fill={phase ? "var(--muted-foreground)" : color} fillOpacity={phase || milestones ? 1 : .28} />
                  {!phase && !milestones && row.progress > 0 && <rect data-gantt-progress="" x={start} y={center - barHeight / 2}
                    width={length * row.progress / 100} height={barHeight} rx={radius} fill={color} />}
                </>}
                {!compact && <text data-gantt-label="" x={phase || !rows[0].taskCount ? 14 : 26} y={center} dominantBaseline="middle"
                  fill={phase || selected === index ? "var(--foreground)" : "var(--muted-foreground)"} fontSize="12" fontWeight={phase ? 600 : 400}>{row.name}</text>}
              </g>;
            })}
            {!compact && today !== undefined && <g data-gantt-today="" color="var(--chart-focus-pill, var(--foreground))">
              <line x1={x(today)} x2={x(today)} y1={top} y2={bottom} stroke="currentColor" strokeOpacity=".5" strokeWidth="1.25" strokeDasharray="4 4" />
              <text x={x(today)} y={bottom + 16} dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize="12">{roadmap ? date(today) : "Today"}</text>
            </g>}
          </g>}
          {!compact && <g aria-hidden="true" fill="var(--muted-foreground)" fontSize="12" textAnchor="middle">
            {schedule.ticks.map(day => <text data-gantt-tick="" key={day} x={x(day)} y={milestones ? bottom + 19.6 : 16.4}>{date(day, roadmap ? shortMonth : shortDate)}</text>)}
          </g>}
        </svg>
        {!compact && loading && <output className="gantt-loading-status">Loading schedule</output>}
        {active && selected !== null && <div className="gantt-readout cartesian-focus-readout" role="status"
          style={{ left: Math.max(0, Math.min(width - 168, hintX)), top: Math.max(0, y(selected) - 62) }}>
          <div className="cartesian-focus-readout-title">{active.name}</div>
          <dl className="cartesian-focus-readout-values">
            {readout(active).map(([name, value]) => <div className="cartesian-focus-readout-row" key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
          </dl>
        </div>}
      </div>
    </div>
    {!compact && <div className="gantt-summary"><strong>{loading ? "Fetching the plan…" : schedule.footer[0]}</strong><span>{schedule.footer[1]}</span></div>}
  </div>;
}
