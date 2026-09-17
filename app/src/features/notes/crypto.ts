import { z } from "zod";
import { PageEnvelope, type PageEnvelope as PageEnvelopeValue } from "@/types/encrypted-page";
import { PageId } from "../../lib/ids";
import { PageDocument, type PageEncryptionContext } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const PageSummaryDocument = z.strictObject({
  version: z.literal(1),
  id: PageId,
  title: z.string().max(10000),
});

const toBase64 = (bytes: Uint8Array<ArrayBuffer>) => btoa(String.fromCharCode(...bytes));

function fromBase64(value: string) {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (toBase64(bytes) !== value) {
    throw new Error("Invalid page encoding.");
  }
  return bytes;
}

function associatedData(pageId: string, keyId: string, purpose: "document" | "summary") {
  const fields = ["aknotes-page", 1, pageId, keyId, "AES-256-GCM"];
  return encoder.encode(JSON.stringify(purpose === "summary" ? [...fields, purpose] : fields));
}

async function encryptJson(
  value: unknown,
  pageId: string,
  encryption: PageEncryptionContext,
  purpose: "document" | "summary",
): Promise<PageEnvelopeValue> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: associatedData(pageId, encryption.keyId, purpose),
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

export async function encryptPage(
  document: PageDocument,
  encryption: PageEncryptionContext,
): Promise<PageEnvelope> {
  const parsed = PageDocument.parse(document) as PageDocument;
  return encryptJson(parsed, parsed.id, encryption, "document");
}

export async function encryptPageSummary(
  document: PageDocument,
  encryption: PageEncryptionContext,
): Promise<PageEnvelope> {
  const summary = PageSummaryDocument.parse({ version: 1, id: document.id, title: document.title });
  return encryptJson(summary, summary.id, encryption, "summary");
}

export async function decryptPageEnvelope(
  pageId: string,
  input: PageEnvelopeValue,
  encryption: PageEncryptionContext,
): Promise<PageDocument> {
  const envelope = PageEnvelope.parse(input);
  if (envelope.keyId !== encryption.keyId) {
    throw new Error("This page was encrypted with a different vault key.");
  }
  try {
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(envelope.nonce),
          additionalData: associatedData(pageId, envelope.keyId, "document"),
          tagLength: 128,
        },
        encryption.key,
        fromBase64(envelope.ciphertext),
      ),
    );
    try {
      const document = PageDocument.parse(JSON.parse(decoder.decode(plaintext))) as PageDocument;
      if (document.id !== pageId) {
        throw new Error("The encrypted page identity does not match its record.");
      }
      return document;
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

export async function decryptPageSummaryEnvelope(
  pageId: string,
  input: PageEnvelopeValue,
  encryption: PageEncryptionContext,
) {
  const envelope = PageEnvelope.parse(input);

  if (envelope.keyId !== encryption.keyId) {
    throw new Error("This page summary was encrypted with a different vault key.");
  }

  try {
    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(envelope.nonce),
          additionalData: associatedData(pageId, envelope.keyId, "summary"),
          tagLength: 128,
        },
        encryption.key,
        fromBase64(envelope.ciphertext),
      ),
    );

    try {
      const summary = PageSummaryDocument.parse(JSON.parse(decoder.decode(plaintext)));
      if (summary.id !== pageId) {
        throw new Error("The encrypted page summary identity does not match its record.");
      }
      return summary;
    } finally {
      plaintext.fill(0);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The encrypted page summary")) {
      throw error;
    }
    throw new Error(
      "Could not decrypt a page summary. Its data may be damaged or use another vault key.",
    );
  }
}
