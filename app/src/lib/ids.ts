import { monotonicFactory } from "ulid";
import { z } from "zod";

const nextUlid = monotonicFactory();
const ULID_PATTERN = "[0-7][0-9A-HJKMNP-TV-Z]{25}";

const prefixedId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_${ULID_PATTERN}$`));

export const VaultId = prefixedId("vlt");
export const PageId = prefixedId("pag");

const createId = (prefix: string): string => `${prefix}_${nextUlid()}`;

export const createVaultId = (): string => createId("vlt");
export const createPageId = (): string => createId("pag");
