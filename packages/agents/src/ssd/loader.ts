import { readFile, readdir } from "fs/promises";
import path from "path";
import { parseSSD } from "./parser.js";
import type { SSDDefinition } from "./schema.js";

export type { SSDDefinition };

const cache = new Map<string, SSDDefinition>();

export async function loadSSD(filePath: string): Promise<SSDDefinition> {
  const cached = cache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }

  const content = await readFile(filePath, "utf8");
  const ssd = parseSSD(content);

  cache.set(filePath, ssd);

  return ssd;
}

export async function loadSSDDirectory(dirPath: string): Promise<SSDDefinition[]> {
  const entries = await readdir(dirPath);
  const yamlFiles = entries.filter((f) => f.endsWith(".yaml"));

  const results = await Promise.all(
    yamlFiles.map((f) => loadSSD(path.join(dirPath, f))),
  );

  return results;
}
