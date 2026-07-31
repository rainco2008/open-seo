import { z } from "zod";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

const customerIdSchema = z
  .string()
  .transform((value) => value.replaceAll("-", "").trim())
  .pipe(z.string().regex(/^\d{10}$/));

const personalConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiVersion: z
    .string()
    .regex(/^v\d+$/)
    .default("v25"),
  developerToken: z.string().trim().min(1),
  refreshToken: z.string().trim().min(1),
  customerId: customerIdSchema,
  loginCustomerId: customerIdSchema.optional(),
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z]{3}$/)),
});

const oauthClientSchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
});

export type PersonalGoogleAdsConfig = z.infer<typeof personalConfigSchema> &
  z.infer<typeof oauthClientSchema>;

type PersonalGoogleAdsConfigState =
  | { status: "disabled"; reason: "missing" | "disabled" }
  | { status: "invalid"; reason: "invalid_json" | "invalid_fields" }
  | { status: "ready"; config: PersonalGoogleAdsConfig };

export function parsePersonalGoogleAdsConfig(input: {
  rawConfig: string | undefined;
  clientId: string | undefined;
  clientSecret: string | undefined;
}): PersonalGoogleAdsConfigState {
  if (!input.rawConfig?.trim()) {
    return { status: "disabled", reason: "missing" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input.rawConfig);
  } catch {
    return { status: "invalid", reason: "invalid_json" };
  }

  const configResult = personalConfigSchema.safeParse(raw);
  if (!configResult.success) {
    return { status: "invalid", reason: "invalid_fields" };
  }
  if (!configResult.data.enabled) {
    return { status: "disabled", reason: "disabled" };
  }

  const oauthResult = oauthClientSchema.safeParse({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  });
  if (!oauthResult.success) {
    return { status: "invalid", reason: "invalid_fields" };
  }

  return {
    status: "ready",
    config: { ...configResult.data, ...oauthResult.data },
  };
}

export async function getPersonalGoogleAdsConfigState() {
  const [rawConfig, clientId, clientSecret] = await Promise.all([
    getOptionalEnvValue("PERSONAL_GOOGLE_ADS_CONFIG"),
    getOptionalEnvValue("GOOGLE_CLIENT_ID"),
    getOptionalEnvValue("GOOGLE_CLIENT_SECRET"),
  ]);
  return parsePersonalGoogleAdsConfig({
    rawConfig,
    clientId,
    clientSecret,
  });
}

export function maskGoogleAdsCustomerId(customerId: string) {
  return `••••••${customerId.slice(-4)}`;
}
