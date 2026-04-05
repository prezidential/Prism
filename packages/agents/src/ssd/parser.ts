import yaml from "js-yaml";
import { SSDDefinitionSchema, type SSDDefinition } from "./schema.js";
import { ZodError } from "zod";

export type { SSDDefinition };

export class SSDParseError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "SSDParseError";
  }
}

export function parseSSD(yamlContent: string): SSDDefinition {
  let raw: unknown;
  try {
    raw = yaml.load(yamlContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SSDParseError(`YAML parse error: ${message}`);
  }

  const result = SSDDefinitionSchema.safeParse(raw);

  if (!result.success) {
    const firstError = result.error.errors[0];
    if (firstError === undefined) {
      throw new SSDParseError("SSD validation failed with unknown error");
    }
    const fieldPath = firstError.path.join(".");
    const msg = fieldPath
      ? `${fieldPath}: ${firstError.message}`
      : firstError.message;
    throw new SSDParseError(msg, fieldPath || undefined);
  }

  return result.data;
}
