use std::time::{Duration, Instant};
use serde::Serialize;

const API_BASE: &str = "http://localhost:47300";

#[derive(Debug, Serialize)]
pub struct StressResult {
    pub test_name: String,
    pub requests: u32,
    pub successes: u32,
    pub failures: u32,
    pub duration_ms: u64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub throughput_rps: f64,
    pub memory_before_mb: f64,
    pub memory_after_mb: f64,
    pub memory_delta_mb: f64,
}

fn get_app_memory_mb() -> f64 {
    let snap = crate::snapshot::take_snapshot();
    snap.total_memory_mb
}

// ─── Individual stress tests ───

fn stress_health(count: u32) -> StressResult {
    run_get_stress("api-health", "/api/health", count)
}

fn stress_sse(count: u32) -> StressResult {
    let test_name = "api-sse";
    let mem_before = get_app_memory_mb();
    let start = Instant::now();
    let mut successes = 0u32;
    let mut failures = 0u32;
    let mut latencies = Vec::new();

    // Open N SSE connections concurrently, hold for 2s, then close
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();

    for _ in 0..count {
        let t = Instant::now();
        match client.get(format!("{API_BASE}/api/sse")).send() {
            Ok(resp) if resp.status().is_success() => {
                successes += 1;
                latencies.push(t.elapsed().as_millis() as f64);
            }
            _ => failures += 1,
        }
    }

    let duration = start.elapsed();
    let mem_after = get_app_memory_mb();

    build_result(test_name, count, successes, failures, duration, latencies, mem_before, mem_after)
}

fn stress_rss_sync() -> StressResult {
    let mem_before = get_app_memory_mb();
    let start = Instant::now();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap();

    let resp = client.post(format!("{API_BASE}/api/rss-feeds/sync-all")).send();
    let (successes, failures) = match resp {
        Ok(r) if r.status().is_success() => (1, 0),
        _ => (0, 1),
    };

    let duration = start.elapsed();
    let mem_after = get_app_memory_mb();
    let latencies = vec![duration.as_millis() as f64];

    build_result("api-rss-sync", 1, successes, failures, duration, latencies, mem_before, mem_after)
}

fn stress_analytics() -> StressResult {
    run_get_stress("api-analytics", "/api/analytics?from=2026-01-01&to=2026-04-10", 10)
}

fn stress_concurrent(count: u32) -> StressResult {
    let endpoints = [
        "/api/health",
        "/api/rss-feeds",
        "/api/rss-articles/unread-count",
        "/api/tasks",
        "/api/calendars",
    ];

    let mem_before = get_app_memory_mb();
    let start = Instant::now();
    let mut successes = 0u32;
    let mut failures = 0u32;
    let mut latencies = Vec::new();

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();

    for i in 0..count {
        let endpoint = endpoints[i as usize % endpoints.len()];
        let t = Instant::now();
        match client.get(format!("{API_BASE}{endpoint}")).send() {
            Ok(r) if r.status().is_success() || r.status().as_u16() == 304 => {
                successes += 1;
                latencies.push(t.elapsed().as_millis() as f64);
            }
            _ => failures += 1,
        }
    }

    let duration = start.elapsed();
    let mem_after = get_app_memory_mb();

    build_result("api-concurrent", count, successes, failures, duration, latencies, mem_before, mem_after)
}

// ─── Helpers ───

fn run_get_stress(name: &str, path: &str, count: u32) -> StressResult {
    let mem_before = get_app_memory_mb();
    let start = Instant::now();
    let mut successes = 0u32;
    let mut failures = 0u32;
    let mut latencies = Vec::new();

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();

    for _ in 0..count {
        let t = Instant::now();
        match client.get(format!("{API_BASE}{path}")).send() {
            Ok(r) if r.status().is_success() => {
                successes += 1;
                latencies.push(t.elapsed().as_millis() as f64);
            }
            _ => failures += 1,
        }
    }

    let duration = start.elapsed();
    let mem_after = get_app_memory_mb();

    build_result(name, count, successes, failures, duration, latencies, mem_before, mem_after)
}

fn build_result(
    name: &str,
    count: u32,
    successes: u32,
    failures: u32,
    duration: Duration,
    mut latencies: Vec<f64>,
    mem_before: f64,
    mem_after: f64,
) -> StressResult {
    latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let avg = if latencies.is_empty() { 0.0 } else { latencies.iter().sum::<f64>() / latencies.len() as f64 };
    let p95 = if latencies.is_empty() { 0.0 } else {
        let idx = ((latencies.len() as f64) * 0.95) as usize;
        latencies[idx.min(latencies.len() - 1)]
    };
    let dur_ms = duration.as_millis() as u64;
    let rps = if dur_ms > 0 { successes as f64 / (dur_ms as f64 / 1000.0) } else { 0.0 };

    StressResult {
        test_name: name.to_string(),
        requests: count,
        successes,
        failures,
        duration_ms: dur_ms,
        avg_latency_ms: avg,
        p95_latency_ms: p95,
        throughput_rps: rps,
        memory_before_mb: mem_before,
        memory_after_mb: mem_after,
        memory_delta_mb: mem_after - mem_before,
    }
}

// ─── Runner ───

pub fn run_api_stress() -> Vec<StressResult> {
    println!("\n🔨 Running API stress tests...\n");

    let mut results = Vec::new();

    print!("  [1/5] Health check (100 req)...");
    let r = stress_health(100);
    println!(" {:.0} rps, avg {:.0}ms", r.throughput_rps, r.avg_latency_ms);
    results.push(r);

    print!("  [2/5] SSE connections (20)...");
    let r = stress_sse(20);
    println!(" {}/{} ok, avg {:.0}ms", r.successes, r.requests, r.avg_latency_ms);
    results.push(r);

    print!("  [3/5] RSS sync-all...");
    let r = stress_rss_sync();
    println!(" {}ms, mem delta {:.1}MB", r.duration_ms, r.memory_delta_mb);
    results.push(r);

    print!("  [4/5] Analytics (10 req)...");
    let r = stress_analytics();
    println!(" {:.0} rps, avg {:.0}ms", r.throughput_rps, r.avg_latency_ms);
    results.push(r);

    print!("  [5/5] Concurrent mix (50 req)...");
    let r = stress_concurrent(50);
    println!(" {:.0} rps, {}/{} ok", r.throughput_rps, r.successes, r.requests);
    results.push(r);

    println!();
    results
}

pub fn print_stress_results(results: &[StressResult]) {
    println!("╔════════════════════╦════════╦════════╦════════╦═══════════╦══════════╗");
    println!("║ Test               ║ Req    ║ OK     ║ Fail   ║ Avg ms    ║ Δ RAM MB ║");
    println!("╠════════════════════╬════════╬════════╬════════╬═══════════╬══════════╣");
    for r in results {
        println!("║ {:<18} ║ {:>6} ║ {:>6} ║ {:>6} ║ {:>9.1} ║ {:>+7.1}  ║",
            r.test_name, r.requests, r.successes, r.failures, r.avg_latency_ms, r.memory_delta_mb);
    }
    println!("╚════════════════════╩════════╩════════╩════════╩═══════════╩══════════╝");
}
