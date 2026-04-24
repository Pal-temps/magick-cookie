use serde::{Deserialize, Serialize};
use sysinfo::{ProcessesToUpdate, System};

const APP_NAMES: &[&str] = &["magick-cookie", "msedgewebview2", "bun", "node"];
const PORTS: &[u16] = &[47300, 47420];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub memory_mb: f64,
    pub cpu_percent: f32,
    pub threads: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub timestamp: String,
    pub total_memory_mb: f64,
    pub process_count: usize,
    pub webview_count: usize,
    pub cpu_total_percent: f32,
    pub processes: Vec<ProcessInfo>,
    pub api_listening: bool,
    pub vite_listening: bool,
}

impl Snapshot {
    pub fn delta_mb(&self, other: &Snapshot) -> f64 {
        self.total_memory_mb - other.total_memory_mb
    }
}

pub fn take_snapshot() -> Snapshot {
    let mut sys = System::new();
    // First refresh to establish baseline
    sys.refresh_processes(ProcessesToUpdate::All, true);
    // Short sleep for CPU measurement
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut processes = Vec::new();
    let mut total_memory: u64 = 0;
    let mut webview_count = 0;
    let mut cpu_total: f32 = 0.0;

    for (pid, proc) in sys.processes() {
        let name_lower = proc.name().to_string_lossy().to_lowercase();
        let is_app = APP_NAMES.iter().any(|n| name_lower.contains(n));
        if !is_app {
            continue;
        }

        let mem = proc.memory();
        let cpu = proc.cpu_usage();
        let threads = proc.tasks().map(|t| t.len() as u32);

        if name_lower.contains("msedgewebview2") {
            webview_count += 1;
        }

        total_memory += mem;
        cpu_total += cpu;

        processes.push(ProcessInfo {
            pid: pid.as_u32(),
            name: proc.name().to_string_lossy().into_owned(),
            memory_mb: mem as f64 / 1024.0 / 1024.0,
            cpu_percent: cpu,
            threads,
        });
    }

    // Sort by memory descending
    processes.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap_or(std::cmp::Ordering::Equal));

    let api_listening = check_port_listening(PORTS[0]);
    let vite_listening = check_port_listening(PORTS[1]);

    Snapshot {
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        total_memory_mb: total_memory as f64 / 1024.0 / 1024.0,
        process_count: processes.len(),
        webview_count,
        cpu_total_percent: cpu_total,
        processes,
        api_listening,
        vite_listening,
    }
}

fn check_port_listening(port: u16) -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse().unwrap(),
        std::time::Duration::from_millis(500),
    )
    .is_ok()
}

// ─── Display ───

pub fn print_snapshot(snap: &Snapshot) {
    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  Magick Cookie Benchmark — {}  ║", snap.timestamp);
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Total RAM:  {:>7.1} MB                             ║", snap.total_memory_mb);
    println!("║  Total CPU:  {:>7.1} %                              ║", snap.cpu_total_percent);
    println!("║  Processes:  {:>3}  (WebView2: {})                   ║", snap.process_count, snap.webview_count);
    println!("║  API :47300: {}   Vite :47420: {}             ║",
        if snap.api_listening { "✓" } else { "✗" },
        if snap.vite_listening { "✓" } else { "✗" },
    );
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  PID     Name                     RAM MB   CPU %    ║");
    println!("╟──────────────────────────────────────────────────────╢");
    for p in &snap.processes {
        let name_trunc: String = p.name.chars().take(22).collect();
        println!("║  {:<7} {:<22} {:>7.1} {:>6.1}    ║", p.pid, name_trunc, p.memory_mb, p.cpu_percent);
    }
    println!("╚══════════════════════════════════════════════════════╝");
}

pub fn print_delta(current: &Snapshot, baseline: &Snapshot) {
    let delta = current.delta_mb(baseline);
    let sign = if delta >= 0.0 { "+" } else { "" };
    let proc_delta = current.process_count as i32 - baseline.process_count as i32;

    println!("\n── Delta from baseline ──");
    println!("  RAM:       {}{:.1} MB  ({:.1} → {:.1})", sign, delta, baseline.total_memory_mb, current.total_memory_mb);
    println!("  Processes: {:+}  ({} → {})", proc_delta, baseline.process_count, current.process_count);
    println!("  WebView2:  {:+}  ({} → {})",
        current.webview_count as i32 - baseline.webview_count as i32,
        baseline.webview_count, current.webview_count);

    if delta.abs() > 50.0 {
        println!("  ⚠ Large memory change detected!");
    }
}
