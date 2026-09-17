import type { z } from "zod";
import { SavePage } from "../../src/types";
import { validEnvelope } from "./envelope";

export const validPage = (
  overrides: Partial<z.infer<typeof SavePage>> = {},
): z.infer<typeof SavePage> => {
  const keyId =
    overrides.envelope?.keyId ?? overrides.summaryEnvelope?.keyId ?? crypto.randomUUID();
  return {
    expectedRevision: 0,
    envelope: validEnvelope({ keyId }),
    summaryEnvelope: validEnvelope({ keyId }),
    ...overrides,
  };
};
