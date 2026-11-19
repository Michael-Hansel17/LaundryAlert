import { logger, type Logger } from './logger';

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike { getGlobalHandler(): GlobalHandler; setGlobalHandler(handler: GlobalHandler): void }
interface HermesLike { enablePromiseRejectionTracker?(options: { allRejections: boolean; onUnhandled(id: number, error: unknown): void }): void }
interface GlobalLike {
  ErrorUtils?: ErrorUtilsLike;
  HermesInternal?: HermesLike;
  addEventListener?(type: string, listener: (event: { reason?: unknown; error?: unknown; message?: string }) => void): void;
}

let installed = false;

// Records uncaught JS errors and unhandled promise rejections, then lets the default handler run
// (red box in development, crash/close in a release build). Safe to call more than once.
export function installCrashHandlers(target: GlobalLike = globalThis as GlobalLike, log: Logger = logger) {
  if (installed && target === globalThis) return;
  if (target === globalThis) installed = true;

  const utils = target.ErrorUtils;
  if (utils?.getGlobalHandler && utils.setGlobalHandler) {
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, isFatal) => {
      log.error('crash', isFatal ? 'Error fatal tidak tertangani' : 'Error tidak tertangani', { error });
      // Persist before the app may be torn down; the default handler runs regardless.
      void log.flush();
      previous?.(error, isFatal);
    });
  }

  const onRejection = (reason: unknown) => {
    log.error('crash', 'Promise ditolak tanpa penanganan', { error: reason });
    void log.flush();
  };
  if (target.HermesInternal?.enablePromiseRejectionTracker) {
    try {
      target.HermesInternal.enablePromiseRejectionTracker({ allRejections: true, onUnhandled: (_id, error) => onRejection(error) });
    } catch { /* tracker already owned by the RN dev tooling */ }
  }
  if (typeof target.addEventListener === 'function') {
    // Web has no Hermes tracker; window events catch rejections, and errors when ErrorUtils is absent.
    target.addEventListener('unhandledrejection', (event) => onRejection(event.reason));
    if (!utils) target.addEventListener('error', (event) => {
      log.error('crash', 'Error tidak tertangani', { error: event.error ?? event.message });
      void log.flush();
    });
  }
}
