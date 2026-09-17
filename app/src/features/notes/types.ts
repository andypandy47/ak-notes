import type { PartialBlock } from "@blocknote/core";
import { z } from "zod";
import { PageId } from "../../lib/ids";

export const PageDocument = z.strictObject({
  version: z.literal(1),
  id: PageId,
  title: z.string().max(10000),
  blocks: z.array(z.record(z.string(), z.unknown())),
});

export type PageDocument = Omit<z.infer<typeof PageDocument>, "blocks"> & {
  blocks: PartialBlock[];
};

export type Page = {
  document: PageDocument;
  revision: number;
  updatedAt: string;
};

export type PageSummary = {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
};

export type PageChanges = Pick<Partial<PageDocument>, "title" | "blocks">;

export type PageEncryptionContext = { key: CryptoKey; keyId: string };
