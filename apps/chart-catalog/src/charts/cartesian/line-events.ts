export interface LineEvent {
  icon: string;
  title: string;
  description?: string;
}

/** Accept the original emoji/title strings as well as detailed caller events. */
export function readLineEvents(row: Record<string, unknown> | undefined): LineEvent[] {
  if (!Array.isArray(row?.events)) return [];
  return row.events.flatMap((value): LineEvent[] => {
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return [];
      const space = text.indexOf(" ");
      const icon = text.slice(0, space);
      return space < 0 || /[\p{L}\p{N}]/u.test(icon) ? [{ icon: "•", title: text }]
        : [{ icon, title: text.slice(space + 1) }];
    }
    if (!value || typeof value !== "object") return [];
    const title = typeof value.title === "string" ? value.title : typeof value.label === "string" ? value.label : "";
    if (!title.trim()) return [];
    return [{ icon: typeof value.icon === "string" ? value.icon : "•", title,
      description: typeof value.description === "string" ? value.description : undefined }];
  });
}

// Adapted from Bklit UI's MIT-licensed MarkerGroup fan geometry.
// https://github.com/bklit/bklit-ui/blob/a02b9496b0ea4b665bd12f234d75ec2aa87baa5a/packages/ui/src/charts/markers/marker-group.tsx
export function lineEventFanPosition(index: number, total: number) {
  const angle = (-170 + (total > 1 ? index * 160 / (total - 1) : 0)) * Math.PI / 180;
  return { x: Math.cos(angle) * 50, y: Math.sin(angle) * 50 };
}
