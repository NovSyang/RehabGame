#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Windows Release 使用 GUI 子系统避免弹出终端，Debug 仍保留终端便于排查问题。
fn main() {
    rehab_bsbt91_game_lib::run();
}
