use crate::snapshot::Snapshot;
use std::path::PathBuf;

fn baseline_path() -> PathBuf {
    let dir = dirs_next().unwrap_or_else(|| PathBuf::from("."));
    dir.join(".benchmark-baseline.json")
}

fn dirs_next() -> Option<PathBuf> {
    // Store baseline next to the executable or in project root
    std::env::current_dir().ok()
}

pub fn save_baseline(snap: &Snapshot) {
    let path = baseline_path();
    match serde_json::to_string_pretty(snap) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&path, json) {
                eprintln!("Failed to save baseline: {e}");
            } else {
                println!("✓ Baseline saved to {}", path.display());
            }
        }
        Err(e) => eprintln!("Failed to serialize baseline: {e}"),
    }
}

pub fn load_baseline() -> Option<Snapshot> {
    let path = baseline_path();
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn compare_with_baseline(current: &Snapshot) {
    match load_baseline() {
        Some(baseline) => {
            println!("\n── Baseline comparison ──");
            println!("  Baseline: {} ({:.1} MB, {} processes)",
                baseline.timestamp, baseline.total_memory_mb, baseline.process_count);
            println!("  Current:  {} ({:.1} MB, {} processes)",
                current.timestamp, current.total_memory_mb, current.process_count);
            crate::snapshot::print_delta(current, &baseline);

            // Per-process comparison
            let base_map: std::collections::HashMap<String, f64> = baseline.processes.iter()
                .map(|p| (p.name.clone(), p.memory_mb))
                .fold(std::collections::HashMap::new(), |mut acc, (name, mem)| {
                    *acc.entry(name).or_insert(0.0) += mem;
                    acc
                });
            let curr_map: std::collections::HashMap<String, f64> = current.processes.iter()
                .map(|p| (p.name.clone(), p.memory_mb))
                .fold(std::collections::HashMap::new(), |mut acc, (name, mem)| {
                    *acc.entry(name).or_insert(0.0) += mem;
                    acc
                });

            println!("\n  Per-process deltas:");
            let mut all_names: Vec<_> = base_map.keys().chain(curr_map.keys()).cloned().collect();
            all_names.sort();
            all_names.dedup();
            for name in all_names {
                let base = base_map.get(&name).copied().unwrap_or(0.0);
                let curr = curr_map.get(&name).copied().unwrap_or(0.0);
                let delta = curr - base;
                if delta.abs() > 1.0 {
                    println!("    {}: {:+.1} MB ({:.1} → {:.1})", name, delta, base, curr);
                }
            }
        }
        None => {
            eprintln!("No baseline found. Run with --baseline save first.");
        }
    }
}
