import type { LineEvent } from "./line-events";

// Adapted from Bklit UI's MIT-licensed MarkerTooltipContent.
// https://github.com/bklit/bklit-ui/blob/a02b9496b0ea4b665bd12f234d75ec2aa87baa5a/packages/ui/src/charts/markers/chart-markers.tsx
export function LineEventReadout({ events }: { events: readonly LineEvent[] }) {
  if (!events.length) return null;
  return <div className="line-detail-event-readout">
    {events.slice(0, 2).map((event, index) => <div className="line-detail-event-row" key={index}>
      <span className="line-detail-event-icon" aria-hidden="true">{event.icon}</span>
      <div className="line-detail-event-copy"><div className="line-detail-event-title">{event.title}</div>
        {event.description && <div className="line-detail-event-description">{event.description}</div>}
      </div>
    </div>)}
    {events.length > 2 && <div className="line-detail-event-more">+{events.length - 2} more...</div>}
  </div>;
}
