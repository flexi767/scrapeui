import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

interface Body {
  onlyMake?: string;
  searchPath?: string;
  pubtype?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Body;
  const scriptArgs: string[] = [];

  if (body.onlyMake?.trim()) {
    scriptArgs.push('--make', body.onlyMake.trim());
  }
  if (body.searchPath?.trim()) {
    scriptArgs.push('--search-path', body.searchPath.trim());
  }
  if (body.pubtype?.trim()) {
    scriptArgs.push('--pubtype', body.pubtype.trim());
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (data: object) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const child = spawn(path.join(process.cwd(), 'node_modules/.bin/tsx'), [
        path.join(process.cwd(), 'scraper/scripts/sync-mobilebg-makes-models.ts'),
        ...scriptArgs,
      ], {
        env: process.env,
      });

      let stdoutBuffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            send(JSON.parse(line));
          } catch {
            send({ type: 'log', level: 'stdout', message: line });
          }
        }
      });

      let stderrBuffer = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuffer += chunk.toString();
        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim()) send({ type: 'log', level: 'stderr', message: line });
        }
      });

      child.on('close', (code: number | null) => {
        send({ type: 'exit', code });
        controller.close();
      });

      child.on('error', (error: Error) => {
        send({ type: 'error', message: error.message });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
