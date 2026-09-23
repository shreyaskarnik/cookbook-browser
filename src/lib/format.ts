/** Human-readable download sizes. Decimal units, to match what Hugging Face reports. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/** A probability as a percent. Below 1% keeps one decimal, so a small but non-zero
 *  probability does not render as a flat "0%". */
export function formatPercent(fraction: number): string {
  const percent = fraction * 100;
  if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
