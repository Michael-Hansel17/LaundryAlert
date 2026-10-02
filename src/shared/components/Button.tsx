import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme/theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  loadingTitle?: string;
}

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false, loadingTitle = 'Memproses...' }: Props) {
  const blocked = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked, busy: loading }} onPress={onPress} disabled={blocked}
    style={({ pressed }) => [styles.base, styles[variant], (blocked || pressed) && styles.dim]}>
    {loading && <ActivityIndicator color={variant === 'primary' ? theme.colors.surface : theme.colors.primary} />}
    <Text style={[styles.label, { color: variant === 'primary' ? theme.colors.surface : theme.colors.primary }]}>{loading ? loadingTitle : title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: theme.spacing.sm },
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border, borderWidth: 1 },
  ghost: { backgroundColor: 'transparent' },
  label: { fontSize: theme.fontSize.body, fontWeight: '600', textAlign: 'center' },
  dim: { opacity: 0.55 },
});
