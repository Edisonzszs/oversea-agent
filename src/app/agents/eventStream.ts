type EventProducer<T> = (
  emit: (event: T) => void,
  signal: AbortSignal,
) => Promise<void> | void;

interface PendingReader<T> {
  resolve: (result: IteratorResult<T>) => void;
  reject: (error: unknown) => void;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

export function createEventStream<T>(
  producer: EventProducer<T>,
  signal: AbortSignal,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      const queue: T[] = [];
      const readers: Array<PendingReader<T>> = [];
      const producerController = new AbortController();
      let producerDone = false;
      let returned = false;
      let hasError = false;
      let terminalError: unknown;
      let cleanedUp = false;

      const doneResult = (): IteratorResult<T> => ({
        done: true,
        value: undefined,
      });
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        signal.removeEventListener("abort", onParentAbort);
        producerController.signal.removeEventListener("abort", onProducerAbort);
      };
      const settleReaders = () => {
        while (readers.length > 0 && queue.length > 0) {
          const reader = readers.shift();
          if (!reader) break;
          reader.resolve({ done: false, value: queue.shift() as T });
        }
        if (queue.length > 0) return;

        if (returned || (producerDone && !hasError)) {
          for (const reader of readers.splice(0)) reader.resolve(doneResult());
          cleanup();
          return;
        }
        if (hasError) {
          for (const reader of readers.splice(0)) reader.reject(terminalError);
          cleanup();
        }
      };
      const emit = (event: T) => {
        if (returned || producerDone || hasError) return;
        const reader = readers.shift();
        if (reader) reader.resolve({ done: false, value: event });
        else queue.push(event);
      };
      const onProducerAbort = () => {
        if (returned) return;
        queue.length = 0;
        terminalError = abortError();
        hasError = true;
        producerDone = true;
        settleReaders();
      };
      const onParentAbort = () => producerController.abort();

      producerController.signal.addEventListener("abort", onProducerAbort, {
        once: true,
      });
      if (signal.aborted) producerController.abort();
      else signal.addEventListener("abort", onParentAbort, { once: true });

      void Promise.resolve()
        .then(() => {
          if (returned || hasError) return;
          return producer(emit, producerController.signal);
        })
        .then(() => {
          if (returned || hasError) return;
          producerDone = true;
          settleReaders();
        })
        .catch((error: unknown) => {
          if (returned || hasError) return;
          terminalError = error;
          hasError = true;
          producerDone = true;
          settleReaders();
        });

      return {
        next(): Promise<IteratorResult<T>> {
          if (returned) return Promise.resolve(doneResult());
          if (queue.length > 0) {
            return Promise.resolve({ done: false, value: queue.shift() as T });
          }
          if (hasError) return Promise.reject(terminalError);
          if (producerDone) {
            cleanup();
            return Promise.resolve(doneResult());
          }
          return new Promise<IteratorResult<T>>((resolve, reject) => {
            readers.push({ resolve, reject });
          });
        },
        return(): Promise<IteratorResult<T>> {
          if (returned) return Promise.resolve(doneResult());
          returned = true;
          queue.length = 0;
          producerDone = true;
          for (const reader of readers.splice(0)) reader.resolve(doneResult());
          cleanup();
          producerController.abort();
          return Promise.resolve(doneResult());
        },
      };
    },
  };
}
