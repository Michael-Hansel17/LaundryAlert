import { appendFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export type ServerLogLevel = 'info' | 'warn' | 'error';
export interface ServerLogFields { [key: string]: unknown }
export interface ServerLogger { log(level: ServerLogLevel, msg: string, fields?: ServerLogFields): void }

export const noopLogger: ServerLogger = { log: () => {} };

const SECRET_KEY = /pass(word)?|token|authorization|secret|photo/i;
const clean = (fields: ServerLogFields): ServerLogFields => {
  const out: ServerLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (SECRET_KEY.test(key)) out[key] = '[redacted]';
    else if (value instanceof Error) out[key] = { name: value.name, message: value.message, stack: value.stack };
    else out[key] = value;
  }
  return out;
};

// Collects entries in memory (tests).
export function memoryLogger() {
  const entries: ({ level: ServerLogLevel; msg: string } & ServerLogFields)[] = [];
  const logger: ServerLogger = { log: (level, msg, fields = {}) => { entries.push({ level, msg, ...clean(fields) }); } };
  return { logger, entries };
}

export interface FileLoggerOptions { dir: string; retentionDays?: number; console?: boolean; clock?: () => Date }

// One JSON object per line in <dir>/server-YYYY-MM-DD.log (UTC date), mirrored to the console.
// Files older than retentionDays are removed at start-up.
export function fileLogger({ dir, retentionDays = 14, console: mirror = true, clock = () => new Date() }: FileLoggerOptions): ServerLogger {
  mkdirSync(dir, { recursive: true });
  const cutoff = clock().getTime() - retentionDays * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(dir)) {
    const day = /^server-(\d{4}-\d{2}-\d{2})\.log$/.exec(name)?.[1];
    if (day && Date.parse(`${day}T23:59:59Z`) < cutoff) {
      try { unlinkSync(join(dir, name)); } catch { /* in use: retry next start */ }
    }
  }
  return {
    log(level, msg, fields = {}) {
      const at = clock().toISOString();
      const line = JSON.stringify({ at, level, msg, ...clean(fields) });
      try { appendFileSync(join(dir, `server-${at.slice(0, 10)}.log`), `${line}\n`); } catch { /* disk issue: console still has it */ }
      if (mirror) (level === 'info' ? console.log : console.warn)(line);
    },
  };
}
