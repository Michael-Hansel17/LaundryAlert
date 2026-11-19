import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { logger as appLogger, type LogEntry, type LogLevel, type Logger } from '../services/logger';
import { theme, ui } from '../theme/theme';

type Filter = 'all' | Exclude<LogLevel, 'debug'>;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua' }, { key: 'info', label: 'Info' }, { key: 'warn', label: 'Peringatan' }, { key: 'error', label: 'Error' },
];
const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const SHOWN = 200;
const levelColor = (level: LogLevel) => level === 'error' ? theme.colors.danger : level === 'warn' ? '#9A5B00' : level === 'info' ? theme.colors.primary : theme.colors.muted;
const time = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('id-ID', { hour12: false }); };

// Runtime log viewer, reachable from the "Log" header button on every stack (also before sign-in).
export function DiagnosticsView({ logger = appLogger, share = (message: string) => Share.share({ message, title: 'Log LaundryAlert' }) }: {
  logger?: Logger; share?: (message: string) => Promise<unknown>;
}) {
  const entries = useSyncExternalStore(logger.subscribe, logger.getEntries, logger.getEntries);
  const [filter, setFilter] = useState<Filter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = useMemo(() => {
    const matching = filter === 'all' ? entries : entries.filter((entry) => RANK[entry.level] >= RANK[filter]);
    return matching.slice(-SHOWN).reverse();
  }, [entries, filter]);
  const counts = useMemo(() => ({ warn: entries.filter((e) => e.level === 'warn').length, error: entries.filter((e) => e.level === 'error').length }), [entries]);
  const context = logger.getContext();

  return <Screen>
    <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.subtitle}>Log diagnostik</Text>
      <Text style={ui.muted}>Catatan kejadian aplikasi untuk melacak masalah: permintaan ke server, error, sesi, izin. Kata sandi, token, dan foto tidak dicatat.</Text>
      {Object.entries(context).map(([key, value]) => <Text key={key} style={styles.mono}>{key}: {String(value)}</Text>)}
      <Text style={ui.body}>{entries.length} entri · {counts.warn} peringatan · {counts.error} error</Text>
      <View style={styles.row}>
        <View style={styles.grow}><Button title="Bagikan log" disabled={!entries.length} onPress={() => {
          void share(logger.exportText()).then(() => setNotice(null), () => setNotice('Log tidak dapat dibagikan dari perangkat ini.'));
        }} /></View>
        <View style={styles.grow}><Button title="Hapus log" variant="secondary" disabled={!entries.length} onPress={() => {
          void logger.clear().then(() => setNotice('Log dihapus.'));
        }} /></View>
      </View>
      {!!notice && <Text accessibilityLiveRegion="polite" style={ui.muted}>{notice}</Text>}
    </View>

    <View style={styles.filters} accessibilityRole="tablist">
      {FILTERS.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: filter === item.key }} onPress={() => setFilter(item.key)}
        style={[styles.chip, filter === item.key && styles.chipActive]}>
        <Text style={[styles.chipLabel, filter === item.key && styles.chipLabelActive]}>{item.label}</Text>
      </Pressable>)}
    </View>

    {!visible.length ? <EmptyState title="Belum ada log" message={filter === 'all' ? 'Log akan muncul saat aplikasi dipakai.' : 'Tidak ada entri pada tingkat ini.'} />
      : <View style={ui.section}>
        {visible.map((entry) => <LogRow key={entry.id} entry={entry} open={expanded === entry.id} onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)} />)}
        {entries.length > SHOWN && <Text style={ui.muted}>Menampilkan {SHOWN} entri terbaru. Bagikan log untuk melihat semuanya.</Text>}
      </View>}
  </Screen>;
}

function LogRow({ entry, open, onToggle }: { entry: LogEntry; open: boolean; onToggle: () => void }) {
  const hasData = entry.data !== undefined;
  return <Pressable accessibilityRole="button" accessibilityHint={hasData ? 'Tampilkan detail entri' : undefined} disabled={!hasData} onPress={onToggle} style={styles.entry}>
    <View style={styles.entryHead}>
      <Text style={[styles.level, { color: levelColor(entry.level) }]}>{entry.level.toUpperCase()}</Text>
      <Text style={ui.muted}>{time(entry.at)} · {entry.tag}</Text>
    </View>
    <Text style={ui.body}>{entry.message}</Text>
    {hasData && open && <Text selectable style={styles.mono}>{JSON.stringify(entry.data, null, 2)}</Text>}
  </Pressable>;
}

export function DiagnosticsScreen() { return <DiagnosticsView />; }

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 140 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: { minHeight: 40, paddingHorizontal: theme.spacing.lg, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipLabel: { color: theme.colors.text, fontSize: theme.fontSize.caption, fontWeight: '600' },
  chipLabelActive: { color: theme.colors.surface },
  entry: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, gap: theme.spacing.xs },
  entryHead: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  level: { fontSize: theme.fontSize.caption, fontWeight: '700' },
  mono: { fontFamily: 'monospace', fontSize: 12, color: theme.colors.muted },
});
