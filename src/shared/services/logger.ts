// Runtime log for tracing problems while the app runs (web, emulator, APK on a phone).
// Kept free of react-native imports so plain Node tests (tsx) can load modules that log.
//   - last MAX_ENTRIES entries in memory, persisted to storage so a crash is readable after restart
//   - secrets (password, token, Authorization, photo data) are redacted before they are stored
//   - optional mirror to console (Metro / browser devtools / adb logcat)

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry { id: string; at: string; level: LogLevel; tag: string; message: string; data?: unknown }
export interface LogStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export const LOG_STORAGE_KEY = '@laundryalert/logs/v1';
export const MAX_ENTRIES = 500;
const MAX_STRING = 500;
const PERSIST_DELAY_MS = 1000;
const SECRET_KEY = /pass(word)?|token|authorization|secret|photo|base64/i;
const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

const truncate = (value: string) => value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (${value.length} karakter)` : value;

// Copies `value` into plain JSON-safe data with secrets removed. Errors keep name/message/stack.
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return /^data:[^;]+;base64,/.test(value) ? '[redacted]' : truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    const out: Record<string, unknown> = { name: value.name, message: truncate(value.message) };
    if (value.stack) out.stack = value.stack.length > 2000 ? `${value.stack.slice(0, 2000)}…` : value.stack;
    for (const [key, item] of Object.entries(value)) out[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(item, depth + 1);
    return out;
  }
  if (depth >= 4) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

const validEntry = (value: unknown): value is LogEntry => {
  const e = value as Partial<LogEntry> | null;
  return !!e && typeof e.id === 'string' && typeof e.at === 'string' && LEVELS.includes(e.level as LogLevel)
    && typeof e.tag === 'string' && typeof e.message === 'string';
};

export function formatEntry(entry: LogEntry): string {
  const data = entry.data === undefined ? '' : ` ${JSON.stringify(entry.data)}`;
  return `${entry.at} ${entry.level.toUpperCase().padEnd(5)} [${entry.tag}] ${entry.message}${data}`;
}

export interface LoggerOptions { clock?: () => Date; console?: boolean; maxEntries?: number }

export class Logger {
  private entries: LogEntry[] = [];
  private listeners = new Set<() => void>();
  private storage: LogStorage | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private sequence = 0;
  private clock: () => Date;
  private mirror: boolean;
  private max: number;
  private context: Record<string, unknown> = {};

  constructor(options: LoggerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.mirror = options.console ?? false;
    this.max = options.maxEntries ?? MAX_ENTRIES;
  }

  configure(options: { console?: boolean }) { if (options.console !== undefined) this.mirror = options.console; }
  // Device / build facts shown on the Log screen and at the top of an exported log.
  setContext(context: Record<string, unknown>) { this.context = { ...this.context, ...(redact(context) as Record<string, unknown>) }; this.emit(); }
  getContext() { return this.context; }

  // Loads entries saved by an earlier run (newer in-memory entries are kept after them).
  async hydrate(storage: LogStorage) {
    this.storage = storage;
    try {
      const raw = await storage.getItem(LOG_STORAGE_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : [];
      const previous = Array.isArray(saved) ? saved.filter(validEntry) : [];
      this.entries = [...previous, ...this.entries].slice(-this.max);
      this.emit();
    } catch (error) {
      this.write('warn', 'logger', 'Log tersimpan tidak dapat dibaca, dimulai dari kosong.', { error });
    }
  }

  debug(tag: string, message: string, data?: unknown) { this.write('debug', tag, message, data); }
  info(tag: string, message: string, data?: unknown) { this.write('info', tag, message, data); }
  warn(tag: string, message: string, data?: unknown) { this.write('warn', tag, message, data); }
  error(tag: string, message: string, data?: unknown) { this.write('error', tag, message, data); }

  private write(level: LogLevel, tag: string, message: string, data?: unknown) {
    const entry: LogEntry = { id: `${Date.now().toString(36)}-${(this.sequence++).toString(36)}`, at: this.clock().toISOString(), level, tag, message: truncate(message) };
    if (data !== undefined) entry.data = redact(data);
    this.entries.push(entry);
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
    if (this.mirror) {
      const line = formatEntry(entry);
      // console.error in React Native dev shows a red box; warn/error entries are informational here.
      if (level === 'error' || level === 'warn') console.warn(line); else console.log(line);
    }
    this.emit();
    this.schedulePersist();
  }

  private schedulePersist() {
    if (!this.storage || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, PERSIST_DELAY_MS);
  }

  // Writes now (used before a crash handler hands over). Writes are queued so they never overlap.
  flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const storage = this.storage;
    if (!storage) return Promise.resolve();
    this.writing = this.writing.then(async () => {
      try { await storage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.entries)); } catch { /* storage full or unavailable: keep in memory */ }
    });
    return this.writing;
  }

  getEntries = (): readonly LogEntry[] => this.entries;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() {
    // A new array identity per change so useSyncExternalStore re-renders.
    this.entries = [...this.entries];
    for (const listener of this.listeners) listener();
  }

  async clear() {
    this.entries = [];
    this.emit();
    await this.flush();
  }

  exportText(): string {
    const header = Object.entries(this.context).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
    return [`LaundryAlert log (${this.entries.length} entri, diekspor ${this.clock().toISOString()})`, ...header, '', ...this.entries.map(formatEntry)].join('\n');
  }
}

// Shared app-wide instance.
export const logger = new Logger();
