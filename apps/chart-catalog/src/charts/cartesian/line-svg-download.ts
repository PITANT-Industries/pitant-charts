import type { ChartTheme } from "./options";

export type ExportFormat = "svg" | "png";
const namespace = "http://www.w3.org/2000/svg";

function svgElement<Tag extends keyof SVGElementTagNameMap>(tag: Tag, attributes: Record<string, string | number>) {
  const element = document.createElementNS(namespace, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

async function embedFont(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Export font unavailable");
  const font = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(font);
  });
}

function appendLegend(root: SVGSVGElement, legend: HTMLElement, left: number, top: number, inset: number) {
  for (const entry of legend.children) {
    const marker = entry.querySelector("i");
    if (marker) {
      const bounds = marker.getBoundingClientRect();
      root.append(svgElement("rect", {
        x: inset + bounds.left - left, y: bounds.top - top,
        width: bounds.width, height: bounds.height, rx: bounds.height / 2,
        fill: getComputedStyle(marker).backgroundColor,
      }));
    }
    for (const label of entry.querySelectorAll("span")) {
      const bounds = label.getBoundingClientRect();
      const css = getComputedStyle(label);
      const text = svgElement("text", {
        x: inset + bounds.left - left, y: bounds.top - top + bounds.height * .75,
        fill: css.color, "font-weight": css.fontWeight, "font-size": css.fontSize,
      });
      text.textContent = label.textContent;
      root.append(text);
    }
  }
}

async function snapshot(plot: SVGSVGElement, legend: HTMLElement, theme: ChartTheme, label: string) {
  await document.fonts.ready;
  const bounds = plot.getBoundingClientRect();
  const legendBounds = legend.getBoundingClientRect();
  const inset = 16;
  const width = bounds.width + 2 * inset;
  const height = Math.max(bounds.height, legendBounds.bottom - bounds.top);
  const style = getComputedStyle(plot);
  const fontAsset = style.fontFamily.includes("Hanken Grotesk")
    ? import("@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url")
    : style.fontFamily.includes("Geist") ? import("@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url") : null;
  const font = fontAsset ? await fontAsset.then(asset => embedFont(asset.default)).catch(() => "") : "";
  const root = svgElement("svg", {
    width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label,
    "font-family": font ? '"Chart Export", system-ui, sans-serif' : style.fontFamily,
  });
  const title = svgElement("title", {});
  title.textContent = label;
  root.append(title);
  if (font) {
    const fontStyle = svgElement("style", {});
    fontStyle.textContent = `@font-face{font-family:"Chart Export";src:url(${font}) format("woff2");font-style:normal;font-weight:100 900}`;
    root.append(fontStyle);
  }
  root.append(svgElement("rect", { width: "100%", height: "100%", fill: style.getPropertyValue("--background").trim() || theme.surface }));
  const cloned = plot.cloneNode(true) as SVGSVGElement;
  cloned.removeAttribute("class");
  cloned.removeAttribute("tabindex");
  cloned.removeAttribute("aria-describedby");
  cloned.setAttribute("x", String(inset));
  cloned.setAttribute("width", String(bounds.width));
  cloned.setAttribute("height", String(bounds.height));
  cloned.setAttribute("overflow", "visible");
  cloned.querySelector("[data-line-sync-export-focus]")?.remove();
  cloned.querySelectorAll("[data-line-metric]").forEach(group => group.removeAttribute("opacity"));
  root.append(cloned);
  appendLegend(root, legend, bounds.left, bounds.top, inset);
  return { width, height, source: new XMLSerializer().serializeToString(root) };
}

export async function downloadRevenueChart(plot: SVGSVGElement, legend: HTMLElement, format: ExportFormat, theme: ChartTheme, label: string) {
  const { width, height, source } = await snapshot(plot, legend, theme, label);
  const vector = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const vectorUrl = URL.createObjectURL(vector);
  let downloadUrl = vectorUrl;
  try {
    if (format === "png") {
      const image = new Image();
      image.src = vectorUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * 2);
      canvas.height = Math.round(height * 2);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PNG export unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png");
      });
      downloadUrl = URL.createObjectURL(png);
    }
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `revenue-by-plan.${format}`;
    link.click();
  } finally {
    const url = downloadUrl;
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (downloadUrl !== vectorUrl) URL.revokeObjectURL(vectorUrl);
  }
}
