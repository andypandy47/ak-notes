import type { PartialBlock } from "@blocknote/core";
import { z } from "zod";

export const PageDocument = z.strictObject({
  version: z.literal(1),
  id: z.uuid(),
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

export type PageChanges = Pick<Partial<PageDocument>, "title" | "blocks">;

export type NotesConnection = { token: string; sessionId: string };
export type PageEncryptionContext = { key: CryptoKey; keyId: string };
