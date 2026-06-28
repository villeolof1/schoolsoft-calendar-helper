use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if !cfg!(debug_assertions) {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Tauri's Rust sidecar API expects only the binary filename,
                    // not the full path used in bundle.externalBin.
                    let sidecar = app_handle
                        .shell()
                        .sidecar("schoolsoft-backend")
                        .expect("failed to create SchoolSoft backend sidecar command");

                    let (mut rx, _child) = sidecar
                        .spawn()
                        .expect("failed to spawn SchoolSoft backend sidecar");

                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(bytes) => {
                                print!("{}", String::from_utf8_lossy(&bytes));
                            }
                            CommandEvent::Stderr(bytes) => {
                                eprint!("{}", String::from_utf8_lossy(&bytes));
                            }
                            _ => {}
                        }
                    }
                });
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SchoolSoft Calendar Helper");
}
