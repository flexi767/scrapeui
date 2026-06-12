import { performance } from "node:perf_hooks";

const target = process.env.LOAD_TEST_URL ?? "http://localhost:3000";
const path = process.env.LOAD_TEST_PATH ?? "/";
const requests = Math.max(1, Number(process.env.LOAD_TEST_REQUESTS ?? 100));
const concurrency = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY ?? 10));

interface Sample {
  ok: boolean;
  status: number;
  ms: number;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function hit(url: string): Promise<Sample> {
  const started = performance.now();
  try {
    const response = await fetch(url, { cache: "no-store" });
    await response.arrayBuffer();
    return { ok: response.ok, status: response.status, ms: performance.now() - started };
  } catch {
    return { ok: false, status: 0, ms: performance.now() - started };
  }
}

async function main() {
  const url = new URL(path, target).toString();
  const samples: Sample[] = [];
  let next = 0;

  async function worker() {
    while (next < requests) {
      next += 1;
      samples.push(await hit(url));
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
  const elapsedSec = (performance.now() - started) / 1000;
  const latencies = samples.map((sample) => sample.ms);
  const failures = samples.filter((sample) => !sample.ok).length;

  console.log(`URL: ${url}`);
  console.log(`Requests: ${samples.length}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Throughput: ${(samples.length / elapsedSec).toFixed(2)} req/s`);
  console.log(`Failures: ${failures}`);
  console.log(`p50: ${percentile(latencies, 50).toFixed(1)} ms`);
  console.log(`p95: ${percentile(latencies, 95).toFixed(1)} ms`);
  console.log(`p99: ${percentile(latencies, 99).toFixed(1)} ms`);

  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
