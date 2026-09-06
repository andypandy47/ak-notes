import type { PartialBlock } from "@blocknote/core";

export type Page = {
  id: string;
  title: string;
  updated: string;
  blocks: PartialBlock[];
};

export type PageChanges = Pick<Partial<Page>, "title" | "blocks">;
