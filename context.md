# AK Notes — project context

Last updated: 9 September 2026.

This document captures the project brief, current implementation, and architecture discussions. Proposed approaches below are not approved implementation decisions.

End-to-end encryption is an agreed requirement because pages may contain sensitive information. The initial implementation works from a device-local database containing encrypted page data before cloud deployment or multi-device synchronization is added.

## Purpose and requirements

AK Notes is a personal note-taking app for its owner. It is not intended to become a multi-user service, and public registration or a general user-account system is not required. Access must nevertheless be restricted to the owner’s authorized devices.

The app should support creating separate pages, giving each page a title, writing Markdown content, saving it, and reopening it later. Notes should be accessible across multiple devices through a separately hosted backend.

The client is being built with Tauri for desktop use. Android is an intended additional target, with build and platform compatibility still to be verified. Cloudflare is the preferred backend host.

The owner has requested Notion-style block editing, including draggable blocks. The interface should have a sidebar listing pages with titles and last-edited metadata, alongside the main writing area. This supersedes the earlier plain Markdown text-area interpretation.

## Repository structure

- `app/`: Tauri application and its React frontend.
- `api/`: separately managed Cloudflare Worker API, OpenAPI documentation, and D1 migrations in the same repository.
- Root `package.json`: npm workspace configuration, currently containing `app`.
- `.agents/skills/`: repository-specific agent skills.

The API directory contains code and configuration. Live notes would be stored in the hosted database, not committed to Git.

## Current implementation

The app uses Tauri 2, React 19, TypeScript, and Vite. Tailwind CSS v4 is connected through the Vite plugin. shadcn/ui is initialized with the Base UI Nova style, neutral theme, and `@/` import alias.

## Backend and proposed synchronization

The current design uses BlockNote with its shadcn integration. It supports page creation, switching, title editing, slash commands, and draggable content blocks. Page documents and summaries are encrypted before being persisted to device-local SQLite. Cloud sync is not connected, and native and Android behavior still need validation.

The recommended storage approach for this editor is a versioned structured block document with Markdown import/export. This remains a proposal. Markdown conversion may lose features with no Markdown equivalent, so the earlier text-only storage approach below needs revisiting before implementation.

The API now uses the scaffold’s Hono, Chanfana, and Zod stack for authenticated page list, fetch, and conditional save endpoints, with generated OpenAPI documentation and local D1 encrypted-envelope storage. The frontend is not connected yet; vault encryption and synchronization remain to be implemented. See api/README.md for the current contract and local setup. The client would access the API, never receive Cloudflare administration credentials, and never connect directly with database administration access.

The backend must store encrypted page payloads, including titles and block content. Decryption keys and plaintext page content must remain on the client. Routing and synchronization metadata, such as opaque page IDs, revisions, and ciphertext sizes, may remain visible to the backend. A private R2 bucket could be added later for encrypted attachments; attachments are not part of the agreed initial scope.

The first proposed milestone is creating or unlocking a local vault, encrypting a page on the client, saving it through a locally running backend, and reopening and decrypting it after an app restart. Persistent client caches must also be encrypted. Key recovery, device authorization, and secure native key storage need explicit designs before use with sensitive real data.

The client saves to a local SQLite database and atomically queues an upload record with each page write. Local persistence is the primary write path; API synchronization is secondary. The initial sync implementation pushes queued pages after unlock, after local commits, and when connectivity returns, then compares the complete remote summary list to find newer pages. Incremental feeds, deletion synchronization, and automatic conflict resolution are deferred until their complexity is justified.

To avoid lost edits, the proposed protocol includes:

- Server-assigned revisions and conditional updates to detect concurrent edits.
- Preservation of both versions when devices edit the same note independently, with resolution on the client.
- Unique operation IDs so retrying an upload does not apply it twice.
- Deletion markers so an older offline device cannot silently resurrect a deleted page.

Trash, revision history, Markdown export, database recovery, and independent backups were discussed as recovery measures. Retention periods and export behavior remain undecided. Synchronization is not a substitute for backups.

## Private access

Private access uses one strong, revocable API token per device, provisioned through an administrative command. The backend stores token hashes; each device protects its credential in encrypted local storage unlocked by the vault passphrase.

This avoids routine account login screens while allowing individual devices to be disconnected. The local API foundation validates provisioned bearer tokens against their stored hashes.

## Working vocabulary

These terms describe the discussion so far; refine them as the product design is agreed.

**Page:** A titled document composed of editable blocks, with Markdown support.

**Owner:** The person whose private notebook this is. The owner is the sole human principal in the intended product, even though the persistence and authentication code uses user records to represent principals.

**Page summary:** The encrypted, sidebar-sized representation of a page containing its title. It is listed separately from the full page so clients can open page content on demand.

**Block:** An individually editable and movable unit within a page, such as a paragraph, heading, or checklist item.

**Device:** A desktop or phone running an installation of AK Notes.

**Device credential:** The revocable API token authorizing one device to access encrypted remote storage. It does not decrypt page content.

**Vault:** The owner’s encrypted collection of pages, unlocked on an authorized client using its decryption key.

**Lock:** Remove the device credential and vault decryption material from working memory while retaining the encrypted device credential for the next unlock.

**Forget device:** Remove the locally saved device credential. This does not revoke the credential at the backend.

The repository includes `grilling` for structured design interviews and `domain-modeling` for terminology and significant architectural decisions. Earlier technical recommendations should remain proposals until the owner accepts them.
