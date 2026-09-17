# Device-local storage is the primary working copy

AK Notes persists encrypted page documents and summaries in a SQLite database on each device, with API synchronization operating asynchronously from a durable local operation queue. This keeps reading and editing independent of connectivity; TanStack Query remains a UI-facing cache rather than a persistence layer, and the local schema is deliberately separate from the server's D1 schema because it also owns device-specific versions and synchronization state.
