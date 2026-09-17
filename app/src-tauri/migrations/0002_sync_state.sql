CREATE TABLE sync_metadata (
    vault_id TEXT PRIMARY KEY,
    last_synced_at TEXT
);

CREATE TRIGGER acknowledge_page_sync
AFTER UPDATE OF sync_state, pending_operation_id ON local_pages
WHEN NEW.sync_state = 'synced' AND OLD.pending_operation_id IS NOT NULL
BEGIN
    DELETE FROM sync_operations
    WHERE vault_id = NEW.vault_id
      AND page_id = NEW.id
      AND operation_id = OLD.pending_operation_id;
END;
