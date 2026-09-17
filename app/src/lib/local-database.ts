import Database from "@tauri-apps/plugin-sql";

const DATABASE_URL = "sqlite:aknotes.db";

let databasePromise: Promise<Database> | null = null;

export function getLocalDatabase() {
  databasePromise ??= Database.load(DATABASE_URL);
  return databasePromise;
}
