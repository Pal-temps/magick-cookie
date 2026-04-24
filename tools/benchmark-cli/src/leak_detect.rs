use std::time::{Duration, Instant};

const LEAK_THRESHOLD_PERCENT: f64 = 10.0;

pub struct LeakResult {
    pub scenario: String,
    pub initial_mb: f64,
    pub final_mb: f64,
    pub peak_mb: f64,
    pub delta_mb: f64,
    pub delta_percent: f64,
    pub leaked: bool,
    pub samples: Vec<f64>,
}

pub fn run_leak_detection(duration_secs: u64) -> Vec<LeakResult> {
    println!("\n🔍 Memory leak detection ({duration_secs}s)...\n");

    let mut results = Vec::new();

    // Scenario 1: Idle — just measure memory drift over time
    results.push(detect_idle(duration_secs));

    // Scenario 2: Repeated API calls — fetch endpoints in a loop
    results.push(detect_api_loop(duration_secs));

    println!();
    for r in &results {
        let status = if r.leaked { "⚠ LEAK" } else { "✓ OK" };
        println!("  {} {}: {:.1} → {:.1} MB (peak {:.1}, Δ{:+.1} MB, {:+.1}%)",
            status, r.scenario, r.initial_mb, r.final_mb, r.peak_mb, r.delta_mb, r.delta_percent);
    }

    results
}

fn detect_idle(duration_secs: u64) -> LeakResult {
    print!("  [1/2] Idle memory drift...");
    let interval = Duration::from_secs(2);
    let deadline = Instant::now() + Duration::from_secs(duration_secs);

    let initial = crate::snapshot::take_snapshot().total_memory_mb;
    let mut peak = initial;
    let mut samples = vec![initial];

    while Instant::now() < deadline {
        std::thread::sleep(interval);
        let current = crate::snapshot::take_snapshot().total_memory_mb;
        if current > peak { peak = current; }
        samples.push(current);
    }

    let final_mb = *samples.last().unwrap();
    let delta = final_mb - initial;
    let percent = if initial > 0.0 { (delta / initial) * 100.0 } else { 0.0 };

    println!(" done ({} samples)", samples.len());

    LeakResult {
        scenario: "idle".to_string(),
        initial_mb: initial,
        final_mb,
        peak_mb: peak,
        delta_mb: delta,
        delta_percent: percent,
        leaked: percent > LEAK_THRESHOLD_PERCENT,
        samples,
    }
}

fn detect_api_loop(duration_secs: u64) -> LeakResult {
    print!("  [2/2] API request loop...");
    let deadline = Instant::now() + Duration::from_secs(duration_secs);
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();

    let endpoints = [
        "http://localhost:47300/api/health",
        "http://localhost:47300/api/rss-feeds",
        "http://localhost:47300/api/rss-articles/unread-count",
        "http://localhost:47300/api/tasks",
    ];

    let initial = crate::snapshot::take_snapshot().total_memory_mb;
    let mut peak = initial;
    let mut samples = vec![initial];
    let mut req_count = 0u32;
    let mut idx = 0;

    while Instant::now() < deadline {
        let _ = client.get(endpoints[idx % endpoints.len()]).send();
        req_count += 1;
        idx += 1;

        // Sample memory every 20 requests
        if req_count % 20 == 0 {
            let current = crate::snapshot::take_snapshot().total_memory_mb;
            if current > peak { peak = current; }
            samples.push(current);
        }
    }

    let final_mb = crate::snapshot::take_snapshot().total_memory_mb;
    samples.push(final_mb);

    let delta = final_mb - initial;
    let percent = if initial > 0.0 { (delta / initial) * 100.0 } else { 0.0 };

    println!(" done ({} req, {} samples)", req_count, samples.len());

    LeakResult {
        scenario: "api-loop".to_string(),
        initial_mb: initial,
        final_mb,
        peak_mb: peak,
        delta_mb: delta,
        delta_percent: percent,
        leaked: percent > LEAK_THRESHOLD_PERCENT,
        samples,
    }
}
