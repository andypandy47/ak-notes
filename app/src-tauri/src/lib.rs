use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

fn device_credential_path(
    app: &tauri::AppHandle,
    environment: &str,
) -> Result<std::path::PathBuf, String> {
    let file_name = match environment {
        "local" => "credential-local.hold",
        "preview" => "credential-preview.hold",
        "production" => "credential.hold",
        _ => return Err("unsupported app environment".to_owned()),
    };
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join(file_name))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn has_device_credential(app: tauri::AppHandle, environment: String) -> Result<bool, String> {
    Ok(device_credential_path(&app, &environment)?.is_file())
}

#[tauri::command]
fn remove_device_credential(app: tauri::AppHandle, environment: String) -> Result<(), String> {
    let path = device_credential_path(&app, &environment)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create local encrypted page storage",
            sql: include_str!("../migrations/0001_local_pages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add simple synchronization state",
            sql: include_str!("../migrations/0002_sync_state.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            Ok(())
        })
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:aknotes.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            has_device_credential,
            remove_device_credential
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
