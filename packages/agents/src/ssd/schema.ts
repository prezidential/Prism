import { z } from "zod";

export const SSDConnectionSchema = z.object({
  type: z.enum(["REST_API", "GraphQL", "JDBC", "EventStream"]),
  baseUrl: z.string().url(),
  authType: z.enum([
    "OAuth2_ClientCredentials",
    "OAuth2_AuthCode",
    "APIKey",
    "BasicAuth",
    "mTLS",
  ]),
  credentialRef: z.string().min(1),
});

export const SSDChangeDetectionSchema = z
  .object({
    type: z.enum(["webhook", "poll", "cdc", "event_stream"]),
    webhookEndpoint: z.string().optional(),
    pollIntervalSeconds: z.number().int().positive().optional(),
    webhookSecret: z.string().optional(),
  })
  .refine(
    (d) => d.type !== "webhook" || d.webhookEndpoint !== undefined,
    {
      message:
        "webhookEndpoint required when changeDetection.type is 'webhook'",
      path: ["webhookEndpoint"],
    },
  );

export const SSDCorrelationFieldSchema = z.object({
  field: z.string().min(1),
  identographField: z.string().min(1),
  priority: z.number().int().nonnegative(),
});

export const SSDFieldMappingSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  transform: z.string().optional(),
});

export const SSDSignificanceRulesSchema = z.object({
  minRiskScoreForAlert: z.number().min(0).max(1),
  privilegedRolePatterns: z.array(z.string()),
  sensitiveGroupPatterns: z.array(z.string()),
});

export const SSDIdentityMappingSchema = z.object({
  sourceType: z.string().min(1),
  targetNodeType: z.string().min(1),
  correlationFields: z.array(SSDCorrelationFieldSchema),
  fieldMappings: z.array(SSDFieldMappingSchema),
});

export const SSDSourceSystemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  version: z.string().optional(),
  connection: SSDConnectionSchema,
  changeDetection: SSDChangeDetectionSchema,
});

export const SSDDefinitionSchema = z.object({
  ssdVersion: z.string().min(1),
  sourceSystem: SSDSourceSystemSchema,
  identityMappings: z.array(SSDIdentityMappingSchema),
  significanceRules: SSDSignificanceRulesSchema.optional(),
});

export type SSDConnection = z.infer<typeof SSDConnectionSchema>;
export type SSDChangeDetection = z.infer<typeof SSDChangeDetectionSchema>;
export type SSDCorrelationField = z.infer<typeof SSDCorrelationFieldSchema>;
export type SSDFieldMapping = z.infer<typeof SSDFieldMappingSchema>;
export type SSDSignificanceRules = z.infer<typeof SSDSignificanceRulesSchema>;
export type SSDIdentityMapping = z.infer<typeof SSDIdentityMappingSchema>;
export type SSDSourceSystem = z.infer<typeof SSDSourceSystemSchema>;
export type SSDDefinition = z.infer<typeof SSDDefinitionSchema>;
