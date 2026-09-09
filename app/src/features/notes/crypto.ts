import { z } from "zod";
import { PageDocument, type Page, type PageEncryptionContext } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const PageEnvelope = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal("AES-256-GCM"),
  keyId: z.uuid(),
  nonce: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  ciphertext: z.base64(),
});

export const EncryptedPage = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
  envelope: PageEnvelope,
});

export type PageEnvelope = z.infer<typeof PageEnvelope>;
export type EncryptedPage = z.infer<typeof EncryptedPage>;

const toBase64 = (bytes: Uint8Array<ArrayBuffer>) => btoa(String.fromCharCode(...bytes));

function fromBase64(value: string) {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (toBase64(bytes) !== value) {
    throw new Error("Invalid page encoding.");
  }
  return bytes;
}

function associatedData(pageId: string, keyId: string) {
  return encoder.encode(JSON.stringify(["aknotes-page", 1, pageId, keyId, "AES-256-GCM"]));
}

export async function encryptPage(
  document: PageDocument,
  encryption: PageEncryptionContext,
): Promise<PageEnvelope> {
  const parsed = PageDocument.parse(document) as PageDocument;
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(parsed));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: associatedData(parsed.id, encryption.keyId),
        tagLength: 128,
      },
      encryption.key,
      plaintext,
    );
    return PageEnvelope.parse({
      version: 1,
      algorithm: "AES-256-GCM",
      keyId: encryption.keyId,
      nonce: toBase64(nonce),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
    });
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptPage(
  input: EncryptedPage,
  encryption: PageEncryptionContext,
): Promise<Page> {
  const page = EncryptedPage.parse(input);
  if (page.envelope.keyId !== encryption.keyId) {
    throw new Error("This page was encrypted with a different vault key.");
  }
  try {
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(page.envelope.nonce),
          additionalData: associatedData(page.id, page.envelope.keyId),
          tagLength: 128,
        },
        encryption.key,
        fromBase64(page.envelope.ciphertext),
      ),
    );
    try {
      const document = PageDocument.parse(JSON.parse(decoder.decode(plaintext))) as PageDocument;
      if (document.id !== page.id) {
        throw new Error("The encrypted page identity does not match its record.");
      }
      return { document, revision: page.revision, updatedAt: page.updatedAt };
    } finally {
      plaintext.fill(0);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The encrypted page")) {
      throw error;
    }
    throw new Error("Could not decrypt a page. Its data may be damaged or use another vault key.");
  }
}
