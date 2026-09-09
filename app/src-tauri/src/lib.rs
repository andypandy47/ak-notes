use tauri::Manager;

const DEVICE_CREDENTIAL_FILE: &str = "device-credential.hold";

fn device_credential_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join(DEVICE_CREDENTIAL_FILE))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn has_device_credential(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(device_credential_path(&app)?.is_file())
}

#[tauri::command]
fn remove_device_credential(app: tauri::AppHandle) -> Result<(), String> {
    let path = device_credential_path(&app)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            has_device_credential,
            remove_device_credential
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
