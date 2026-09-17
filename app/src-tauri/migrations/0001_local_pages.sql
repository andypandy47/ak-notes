PRAGMA foreign_keys = ON;

CREATE TABLE local_pages (
    vault_id TEXT NOT NULL,
    id TEXT NOT NULL,
    envelope TEXT NOT NULL CHECK (json_valid(envelope)),
    summary_envelope TEXT NOT NULL CHECK (json_valid(summary_envelope)),
    remote_revision INTEGER NOT NULL DEFAULT 0 CHECK (remote_revision >= 0),
    local_version INTEGER NOT NULL CHECK (local_version > 0),
    local_updated_at TEXT NOT NULL,
    remote_updated_at TEXT,
    deleted_at TEXT,
    pending_operation_id TEXT,
    sync_state TEXT NOT NULL CHECK (sync_state IN ('pending', 'synced', 'conflict')),
    PRIMARY KEY (vault_id, id)
);

CREATE INDEX local_pages_vault_updated_at
    ON local_pages (vault_id, local_updated_at DESC);

CREATE TABLE sync_operations (
    page_id TEXT NOT NULL,
    vault_id TEXT NOT NULL,
    operation_id TEXT NOT NULL UNIQUE,
    local_version INTEGER NOT NULL CHECK (local_version > 0),
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    created_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_attempt_at TEXT,
    last_error TEXT,
    PRIMARY KEY (vault_id, page_id),
    FOREIGN KEY (vault_id, page_id) REFERENCES local_pages (vault_id, id) ON DELETE CASCADE
);

CREATE TRIGGER queue_local_page_insert
AFTER INSERT ON local_pages
WHEN NEW.pending_operation_id IS NOT NULL
BEGIN
    INSERT INTO sync_operations (
        page_id,
        vault_id,
        operation_id,
        local_version,
        operation,
        expected_revision,
        created_at
    ) VALUES (
        NEW.id,
        NEW.vault_id,
        NEW.pending_operation_id,
        NEW.local_version,
        'upsert',
        NEW.remote_revision,
        NEW.local_updated_at
    );
END;

CREATE TRIGGER queue_local_page_update
AFTER UPDATE OF envelope, summary_envelope ON local_pages
WHEN NEW.pending_operation_id IS NOT NULL
BEGIN
    INSERT INTO sync_operations (
        page_id,
        vault_id,
        operation_id,
        local_version,
        operation,
        expected_revision,
        created_at
    ) VALUES (
        NEW.id,
        NEW.vault_id,
        NEW.pending_operation_id,
        NEW.local_version,
        'upsert',
        NEW.remote_revision,
        NEW.local_updated_at
    )
    ON CONFLICT (vault_id, page_id) DO UPDATE SET
        operation_id = excluded.operation_id,
        local_version = excluded.local_version,
        operation = excluded.operation,
        expected_revision = excluded.expected_revision,
        created_at = excluded.created_at,
        attempt_count = 0,
        last_attempt_at = NULL,
        last_error = NULL;
END;
