// Minimal Identograph client surface the risk engine depends on.
//
// Declared structurally (not imported from @prism/identograph) so the risk
// engine stays decoupled from that package's build output and is trivially
// mockable in unit tests. Any object exposing `query` and `command` — including
// the real ArcadeClient — satisfies this interface.

export interface GraphClient {
  // Read-only query. Returns result rows.
  query<T = unknown>(sql: string, language?: string): Promise<T[]>;
  // Write / DDL command. Returns result rows.
  command<T = unknown>(sql: string, language?: string): Promise<T[]>;
}

// Escape a string for safe inline SQL embedding.
export function esc(value: string): string {
  return value.replace(/'/g, "\\'");
}

// Clamp a number into the [0, 1] range.
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// Round to two decimal places — the precision risk scores are reported at.
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
