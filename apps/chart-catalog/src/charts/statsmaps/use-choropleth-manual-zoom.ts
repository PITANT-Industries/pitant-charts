import { useEffect, useRef, useState, type RefObject } from "react";
import type { Coordinate } from "./geo-fixtures";
import { choroplethWheelDelta, defaultPinchDelta, manualMapRest, scaleManualMap, type ManualMapView } from "./choropleth-manual-zoom";

type Drag = { start: Coordinate; origin: ManualMapView; started: boolean; distance: number; rebaseFirstMove: boolean };
type Pinch = { initialDistance: number; offset: number; lastOffset: number; origin: Coordinate; moves: number };

/** Manual gestures stay independent of the click-to-focus camera and its flights. */
export function useChoroplethManualZoom({ host, active }: {
  host: RefObject<HTMLDivElement | null>;
  active: boolean;
}) {
  const [view, setView] = useState(manualMapRest);
  const [isDragging, setIsDragging] = useState(false);
  const viewRef = useRef(view);
  const drag = useRef<Drag | null>(null);
  const pinch = useRef<Pinch | null>(null);
  const pinchOffset = useRef(1);
  const didDrag = useRef(false);

  useEffect(() => {
    const element = host.current;
    if (!active || !element) { didDrag.current = false; setIsDragging(false); return; }
    const svg = element.querySelector<SVGSVGElement>(".choropleth-svg");
    if (!svg) return;
    const update = (next: ManualMapView) => { viewRef.current = next; setView(next); };
    const local = (x: number, y: number): Coordinate => {
      const rect = svg.getBoundingClientRect();
      return [x - rect.left, y - rect.top];
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      update(scaleManualMap(viewRef.current, local(event.clientX, event.clientY), choroplethWheelDelta(event)));
    };
    const startDrag = (point: Coordinate, rebaseFirstMove = false) => {
      didDrag.current = false;
      setIsDragging(false);
      drag.current = { start: point, origin: viewRef.current, started: false, distance: 0, rebaseFirstMove };
    };
    const moveDrag = (point: Coordinate) => {
      const current = drag.current;
      if (!current) return;
      const dx = point[0] - current.start[0], dy = point[1] - current.start[1];
      current.distance = Math.max(current.distance, Math.hypot(dx, dy));
      // The renderer starts its drag on the first move; that event sets up the
      // gesture but does not paint a pan. Later moves use the original down point.
      if (!current.started) {
        current.started = true;
        if (current.rebaseFirstMove) current.start = point;
        setIsDragging(true);
        return;
      }
      didDrag.current = current.distance > 3;
      update({ ...current.origin, x: current.origin.x + dx, y: current.origin.y + dy });
    };
    const mouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startDrag([event.clientX, event.clientY]);
    };
    const mouseMove = (event: MouseEvent) => {
      if (!drag.current || pinch.current) return;
      if (event.buttons === 0) { mouseUp(); return; }
      event.preventDefault();
      moveDrag([event.clientX, event.clientY]);
    };
    const mouseUp = () => { drag.current = null; setIsDragging(false); };
    const blur = () => { mouseUp(); pinch.current = null; };
    const touchPair = (touches: TouchList) => touches.length >= 2 ? {
      distance: Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY),
      origin: [(touches[0].clientX + touches[1].clientX) / 2, (touches[0].clientY + touches[1].clientY) / 2] as Coordinate,
    } : null;
    const emitPinch = (gesture: Pinch) => {
      update(scaleManualMap(viewRef.current, local(...gesture.origin), defaultPinchDelta(gesture.offset, gesture.lastOffset)));
      pinchOffset.current = gesture.offset;
      didDrag.current = true;
    };
    const touchStart = (event: TouchEvent) => {
      const pair = touchPair(event.touches);
      if (pair && !pinch.current) {
        drag.current = null;
        setIsDragging(false);
        const gesture = { initialDistance: pair.distance, origin: pair.origin, offset: pinchOffset.current,
          lastOffset: pinchOffset.current, moves: 0 };
        pinch.current = gesture;
        emitPinch(gesture);
      } else if (!pair && event.touches.length === 1) {
        startDrag([event.touches[0].clientX, event.touches[0].clientY], true);
      }
    };
    const touchMove = (event: TouchEvent) => {
      event.preventDefault();
      const gesture = pinch.current, pair = touchPair(event.touches);
      if (gesture && pair) {
        gesture.origin = pair.origin;
        gesture.offset = pair.distance / (gesture.initialDistance || 1) * gesture.lastOffset;
        // Count browser-delivered touchmove events, not changed fingers or their
        // targets. The reference repeats the second move's distance step once.
        // A native update can deliver one event for a shared target or separate
        // events for different targets, so the repeat may occur in either update.
        gesture.moves += 1;
        if (gesture.moves === 2) emitPinch(gesture);
        emitPinch(gesture);
      } else if (!gesture && event.touches.length === 1) {
        moveDrag([event.touches[0].clientX, event.touches[0].clientY]);
      }
    };
    const touchEnd = (event: TouchEvent) => {
      if (pinch.current && event.touches.length < 2) { emitPinch(pinch.current); pinch.current = null; }
      if (event.touches.length === 0) { drag.current = null; setIsDragging(false); }
    };
    const click = (event: MouseEvent) => {
      if (didDrag.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); }
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    svg.addEventListener("mousedown", mouseDown);
    window.addEventListener("mousemove", mouseMove, { capture: true, passive: false });
    window.addEventListener("mouseup", mouseUp, true);
    window.addEventListener("blur", blur);
    svg.addEventListener("touchstart", touchStart, { passive: false });
    svg.addEventListener("touchmove", touchMove, { passive: false });
    svg.addEventListener("touchend", touchEnd);
    svg.addEventListener("touchcancel", touchEnd);
    svg.addEventListener("click", click, true);
    return () => {
      svg.removeEventListener("wheel", wheel);
      svg.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mousemove", mouseMove, true);
      window.removeEventListener("mouseup", mouseUp, true);
      window.removeEventListener("blur", blur);
      svg.removeEventListener("touchstart", touchStart);
      svg.removeEventListener("touchmove", touchMove);
      svg.removeEventListener("touchend", touchEnd);
      svg.removeEventListener("touchcancel", touchEnd);
      svg.removeEventListener("click", click, true);
      drag.current = null; pinch.current = null; didDrag.current = false;
      setIsDragging(false);
    };
  }, [active, host]);

  return { view: active ? view : manualMapRest, isDragging: active && isDragging, didDrag,
    isInteracting: () => Boolean(drag.current?.started || pinch.current) };
}
