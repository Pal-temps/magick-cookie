mod baseline;
mod leak_detect;
mod snapshot;
mod stress;

use clap::{Parser, Subcommand, ValueEnum};

#[derive(Parser)]
#[command(name = "benchmark", about = "Magick Cookie benchmark & profiling tool")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Output as JSON
    #[arg(long, global = true)]
    json: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Take a single memory/CPU snapshot
    Snapshot,

    /// Watch memory/CPU continuously
    Watch {
        /// Interval in seconds
        #[arg(default_value = "5")]
        interval: u64,
    },

    /// Run stress tests
    Stress {
        /// Target to stress test
        #[arg(value_enum, default_value = "api")]
        target: StressTarget,
    },

    /// Detect memory leaks over a period
    LeakDetect {
        /// Duration in seconds
        #[arg(default_value = "30")]
        duration: u64,
    },

    /// Manage baseline snapshots
    Baseline {
        /// Action: save or compare
        #[arg(value_enum)]
        action: BaselineAction,
    },

    /// Run all benchmarks (snapshot + stress + leak detect)
    Full {
        /// Leak detection duration in seconds
        #[arg(long, default_value = "30")]
        leak_duration: u64,
    },
}

#[derive(Clone, ValueEnum)]
enum StressTarget {
    Api,
}

#[derive(Clone, ValueEnum)]
enum BaselineAction {
    Save,
    Compare,
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        None | Some(Commands::Snapshot) => {
            let snap = snapshot::take_snapshot();
            if cli.json {
                println!("{}", serde_json::to_string_pretty(&snap).unwrap());
            } else {
                snapshot::print_snapshot(&snap);
            }
        }

        Some(Commands::Watch { interval }) => {
            println!("Watching every {interval}s... (Ctrl+C to stop)\n");
            let first = snapshot::take_snapshot();
            snapshot::print_snapshot(&first);

            loop {
                std::thread::sleep(std::time::Duration::from_secs(interval));
                let snap = snapshot::take_snapshot();
                // Clear and reprint
                print!("\x1b[2J\x1b[H"); // ANSI clear screen
                snapshot::print_snapshot(&snap);
                snapshot::print_delta(&snap, &first);
            }
        }

        Some(Commands::Stress { target: _ }) => {
            let results = stress::run_api_stress();
            if cli.json {
                println!("{}", serde_json::to_string_pretty(&results).unwrap());
            } else {
                stress::print_stress_results(&results);
            }
        }

        Some(Commands::LeakDetect { duration }) => {
            let results = leak_detect::run_leak_detection(duration);
            if cli.json {
                let serializable: Vec<_> = results.iter().map(|r| {
                    serde_json::json!({
                        "scenario": r.scenario,
                        "initial_mb": r.initial_mb,
                        "final_mb": r.final_mb,
                        "peak_mb": r.peak_mb,
                        "delta_mb": r.delta_mb,
                        "delta_percent": r.delta_percent,
                        "leaked": r.leaked,
                        "sample_count": r.samples.len(),
                    })
                }).collect();
                println!("{}", serde_json::to_string_pretty(&serializable).unwrap());
            }
        }

        Some(Commands::Baseline { action }) => {
            match action {
                BaselineAction::Save => {
                    let snap = snapshot::take_snapshot();
                    snapshot::print_snapshot(&snap);
                    baseline::save_baseline(&snap);
                }
                BaselineAction::Compare => {
                    let snap = snapshot::take_snapshot();
                    snapshot::print_snapshot(&snap);
                    baseline::compare_with_baseline(&snap);
                }
            }
        }

        Some(Commands::Full { leak_duration }) => {
            println!("═══ Full Benchmark Suite ═══\n");

            // 1. Snapshot
            println!("── Step 1: Snapshot ──");
            let snap = snapshot::take_snapshot();
            snapshot::print_snapshot(&snap);

            // 2. Stress tests
            println!("\n── Step 2: Stress Tests ──");
            let stress_results = stress::run_api_stress();
            stress::print_stress_results(&stress_results);

            // 3. Leak detection
            println!("\n── Step 3: Leak Detection ──");
            let leak_results = leak_detect::run_leak_detection(leak_duration);

            // 4. Final snapshot
            println!("\n── Step 4: Final Snapshot ──");
            let final_snap = snapshot::take_snapshot();
            snapshot::print_snapshot(&final_snap);
            snapshot::print_delta(&final_snap, &snap);

            // Summary
            let leaks_found = leak_results.iter().any(|r| r.leaked);
            let all_stress_ok = stress_results.iter().all(|r| r.failures == 0);

            println!("\n═══ Summary ═══");
            println!("  Stress tests: {}", if all_stress_ok { "✓ All passed" } else { "⚠ Some failures" });
            println!("  Memory leaks: {}", if leaks_found { "⚠ Detected" } else { "✓ None found" });
            println!("  RAM delta:    {:+.1} MB", final_snap.delta_mb(&snap));
        }
    }
}
