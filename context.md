# AK Notes — project context

Last updated: 6 September 2026.

This document captures the project brief, current implementation, and architecture discussions. Proposed approaches below are not approved implementation decisions.

End-to-end encryption is an agreed requirement because pages may contain sensitive information. The initial implementation should work locally before cloud deployment or multi-device synchronization is added. Encryption is not yet implemented.

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

The current design prototype uses BlockNote with its shadcn integration. It supports page creation, switching, title editing, slash commands, and draggable content blocks. Changes remain in memory for the session only; disk persistence and cloud sync are not connected. Native and Android behavior still need validation.

The recommended storage approach for this editor is a versioned structured block document with Markdown import/export. This remains a proposal. Markdown conversion may lose features with no Markdown equivalent, so the earlier text-only storage approach below needs revisiting before implementation.

The API now uses the scaffold’s Hono, Chanfana, and Zod stack for authenticated page list, fetch, and conditional save endpoints, with generated OpenAPI documentation and local D1 encrypted-envelope storage. The frontend is not connected yet; vault encryption and synchronization remain to be implemented. See api/README.md for the current contract and local setup. The client would access the API, never receive Cloudflare administration credentials, and never connect directly with database administration access.

The backend must store encrypted page payloads, including titles and block content. Decryption keys and plaintext page content must remain on the client. Routing and synchronization metadata, such as opaque page IDs, revisions, and ciphertext sizes, may remain visible to the backend. A private R2 bucket could be added later for encrypted attachments; attachments are not part of the agreed initial scope.

The first proposed milestone is creating or unlocking a local vault, encrypting a page on the client, saving it through a locally running backend, and reopening and decrypting it after an app restart. Persistent client caches must also be encrypted. Key recovery, device authorization, and secure native key storage need explicit designs before use with sensitive real data.

The proposed client design saves to a local SQLite database and queues uploads. Offline editing, automatic saving, and background synchronization have been recommended but are not yet confirmed requirements. Synchronization would occur after changes, on app opening or resuming, and periodically while active, without assuming Android keeps the app running in the background.

To avoid lost edits, the proposed protocol includes:

- Server-assigned revisions and conditional updates to detect concurrent edits.
- Preservation of both versions when devices edit the same note independently, with resolution on the client.
- Unique operation IDs so retrying an upload does not apply it twice.
- Deletion markers so an older offline device cannot silently resurrect a deleted page.

Trash, revision history, Markdown export, database recovery, and independent backups were discussed as recovery measures. Retention periods and export behavior remain undecided. Synchronization is not a substitute for backups.

## Proposed private access

The initial suggestion is one strong, revocable API token per device, provisioned through an administrative command. The backend would store token hashes; devices would protect their credentials with native secure storage. The Windows and Android storage implementations still need evaluation.

This avoids routine account login screens while allowing individual devices to be disconnected. Per-device authentication remains a proposal. The local API foundation currently uses one randomly provisioned bearer token, checked against a configured SHA-256 digest.

## Working vocabulary

These terms describe the discussion so far; refine them as the product design is agreed.

**Page:** A titled document composed of editable blocks, with Markdown support.

**Block:** An individually editable and movable unit within a page, such as a paragraph, heading, or checklist item.

**Device:** A desktop or phone running an installation of AK Notes.

**Vault:** The owner’s encrypted collection of pages, unlocked on an authorized client using its decryption key.

The repository includes `grilling` for structured design interviews and `domain-modeling` for terminology and significant architectural decisions. Earlier technical recommendations should remain proposals until the owner accepts them.
