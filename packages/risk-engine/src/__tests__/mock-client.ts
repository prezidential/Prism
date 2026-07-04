// Test helper: a programmable in-memory GraphClient.
//
// `query` returns the rows of the first handler whose matcher matches the SQL;
// `command` records every write for assertion. This keeps scorer tests coupled to
// behavior (what rows the graph returns) rather than to exact SQL text ordering.

import type { GraphClient } from "../client.js";

export type Matcher = string | RegExp | ((sql: string) => boolean);

export interface QueryHandler {
  match: Matcher;
  rows: unknown[];
}

function matches(matcher: Matcher, sql: string): boolean {
  if (typeof matcher === "string") return sql.includes(matcher);
  if (matcher instanceof RegExp) return matcher.test(sql);
  return matcher(sql);
}

export class MockGraphClient implements GraphClient {
  readonly commands: string[] = [];
  readonly queries: string[] = [];

  constructor(private readonly handlers: QueryHandler[] = []) {}

  query<T = unknown>(sql: string): Promise<T[]> {
    this.queries.push(sql);
    for (const handler of this.handlers) {
      if (matches(handler.match, sql)) return Promise.resolve(handler.rows as T[]);
    }
    return Promise.resolve([]);
  }

  command<T = unknown>(sql: string): Promise<T[]> {
    this.commands.push(sql);
    return Promise.resolve([] as T[]);
  }
}

// Deterministic signal-writer deps for tests.
export function testDeps(): { now(): string; newId(): string } {
  let counter = 0;
  return {
    now: () => "2026-07-04T00:00:00.000Z",
    newId: () => `id-${++counter}`,
  };
}
