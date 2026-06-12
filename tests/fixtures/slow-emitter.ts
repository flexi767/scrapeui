/**
 * Test fixture for child-stream tests: emits a JSON line every 100ms,
 * then a final `complete` event. Mirrors the protocol of the real
 * scraper/scripts/run-*.ts workers.
 */
const ticks = Number(process.argv[2] ?? 20);

async function main() {
  for (let i = 0; i < ticks; i++) {
    process.stdout.write(`${JSON.stringify({ type: 'log', level: 'info', message: `tick ${i} pid ${process.pid}` })}\n`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  process.stdout.write(`${JSON.stringify({ type: 'complete', message: 'done' })}\n`);
}

void main();
