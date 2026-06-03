'use client';

import { useRef, useState } from 'react';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { errorMessage, isAbortError } from '@/lib/utils';

interface UseStreamingRunOptions<TEvent> {
  fallbackStartError: string;
  onEvent: (event: TEvent) => void;
  onFinish?: () => void;
  onStartError?: (message: string) => void;
  onStopError?: (message: string) => void;
  onStopRequested?: () => void;
  onStreamError?: (message: string) => void;
  start: (signal: AbortSignal) => Promise<Response>;
  stop: () => Promise<void>;
}

export function useStreamingRun<TEvent>({
  fallbackStartError,
  onEvent,
  onFinish,
  onStartError,
  onStopError,
  onStopRequested,
  onStreamError,
  start,
  stop,
}: UseStreamingRunOptions<TEvent>) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef<UseStreamingRunOptions<TEvent> | null>(null);

  optionsRef.current = {
    fallbackStartError,
    onEvent,
    onFinish,
    onStartError,
    onStopError,
    onStopRequested,
    onStreamError,
    start,
    stop,
  };

  function finish() {
    abortRef.current = null;
    setRunning(false);
    setStopping(false);
    optionsRef.current?.onFinish?.();
  }

  async function run() {
    const options = optionsRef.current;
    if (!options) return;

    const abortController = new AbortController();
    abortRef.current = abortController;
    setRunning(true);
    setStopping(false);

    let response: Response;
    try {
      response = await options.start(abortController.signal);
    } catch (error) {
      if (!isAbortError(error)) {
        optionsRef.current?.onStartError?.(errorMessage(error, optionsRef.current?.fallbackStartError ?? fallbackStartError));
      }
      finish();
      return;
    }

    if (!response.ok || !response.body) {
      optionsRef.current?.onStartError?.(await readJsonError(response, optionsRef.current?.fallbackStartError ?? fallbackStartError));
      finish();
      return;
    }

    try {
      await streamJsonEvents<TEvent>(response, (event) => optionsRef.current?.onEvent(event));
    } catch (error) {
      if (!isAbortError(error)) {
        optionsRef.current?.onStreamError?.(errorMessage(error, optionsRef.current?.fallbackStartError ?? fallbackStartError));
      }
    } finally {
      finish();
    }
  }

  async function requestStop() {
    if (!running || stopping) return;
    setStopping(true);

    try {
      await optionsRef.current?.stop();
      optionsRef.current?.onStopRequested?.();
    } catch (error) {
      optionsRef.current?.onStopError?.(errorMessage(error, 'Failed to stop'));
      setStopping(false);
      return;
    }

    abortRef.current?.abort();
  }

  return {
    running,
    stopping,
    run,
    stop: requestStop,
  };
}
