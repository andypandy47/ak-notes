# AK Notes — project context

Last updated: 6 September 2026.

This document captures the project brief, current implementation, and architecture discussions. Proposed approaches below are not approved implementation decisions.

## Purpose and requirements

AK Notes is a personal note-taking app for its owner. It is not intended to become a multi-user service, and public registration or a general user-account system is not required. Access must nevertheless be restricted to the owner’s authorized devices.

The app should support creating separate pages, giving each page a title, writing Markdown content, saving it, and reopening it later. Notes should be accessible across multiple devices through a separately hosted backend.

The client is being built with Tauri for desktop use. Android is an intended additional target, with build and platform compatibility still to be verified. Cloudflare is the preferred backend host.

The exact editing experience is still open. A “blank canvas” has provisionally been interpreted as a freeform Markdown document; a spatial editor with draggable blocks has not been requested or agreed.

## Repository structure

- `app/`: Tauri application and its React frontend.
- `backend/` (planned, not created): separately managed backend code, database migrations, and deployment configuration in the same repository.
- Root `package.json`: npm workspace configuration, currently containing `app`.
- `.agents/skills/`: repository-specific agent skills.

The planned backend directory contains code and configuration. Live notes would be stored in the hosted database, not committed to Git.

## Current implementation

The app uses Tauri 2, React 19, TypeScript, and Vite. Tailwind CSS v4 is connected through the Vite plugin. shadcn/ui is initialized with the Base UI Nova style, neutral theme, and `@/` import alias.

## Proposed backend and synchronization

The approach discussed is a TypeScript Cloudflare Worker exposing an authenticated HTTPS API, with Cloudflare D1 storing notes and synchronization records. The client would access the API, never receive Cloudflare administration credentials, and never connect directly with database administration access.

For text notes, D1 would store titles and Markdown bodies, or their encrypted equivalents if end-to-end encryption is adopted. A private R2 bucket could be added later for attachments; attachments are not part of the agreed initial scope.

The proposed client design saves to a local SQLite database and queues uploads. Offline editing, automatic saving, and background synchronization have been recommended but are not yet confirmed requirements. Synchronization would occur after changes, on app opening or resuming, and periodically while active, without assuming Android keeps the app running in the background.

To avoid lost edits, the proposed protocol includes:

- Server-assigned revisions and conditional updates to detect concurrent edits.
- Preservation of both versions when devices edit the same note independently, with resolution on the client.
- Unique operation IDs so retrying an upload does not apply it twice.
- Deletion markers so an older offline device cannot silently resurrect a deleted note.

Trash, revision history, Markdown export, database recovery, and independent backups were discussed as recovery measures. Retention periods and export behavior remain undecided. Synchronization is not a substitute for backups.

## Proposed private access

The initial suggestion is one strong, revocable API token per device, provisioned through an administrative command. The backend would store token hashes; devices would protect their credentials with native secure storage. The Windows and Android storage implementations still need evaluation.

This avoids routine account login screens while allowing individual devices to be disconnected. The authentication approach is still a proposal.

## Working vocabulary

These terms describe the discussion so far; refine them as the product design is agreed.

**Page / note:** A titled Markdown document. Both terms have been used interchangeably; the canonical UI term is still to be chosen.

**Device:** A desktop or phone running an installation of AK Notes.

**Vault (proposed):** The owner’s encrypted collection of notes, if end-to-end encryption is adopted.

The repository includes `grilling` for structured design interviews and `domain-modeling` for terminology and significant architectural decisions. Earlier technical recommendations should remain proposals until the owner accepts them.
