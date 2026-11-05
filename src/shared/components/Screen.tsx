import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { theme } from '../theme/theme';

export const WIDE_BREAKPOINT = 768;
export const CONTENT_MAX_WIDTH = 880;

export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, isWide: width >= WIDE_BREAKPOINT, isCompact: width < 360 };
}

export function Screen({ children }: { children: ReactNode }) {
  const headerHeight = useHeaderHeight();
  const { isWide, isCompact } = useLayout();
  const padding = isCompact ? theme.spacing.lg : isWide ? theme.spacing.xxl : theme.spacing.xl;
  return <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.scroll}>
        <View style={[styles.content, { padding, gap: padding }]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Daftar kartu: satu kolom di layar kecil, dua kolom di layar lebar. */
export function CardList({ children }: { children: ReactNode }) {
  const { isWide } = useLayout();
  return <View style={[styles.list, isWide && styles.listWide]}>
    {Array.isArray(children)
      ? children.map((child, i) => <View key={i} style={isWide ? styles.cell : undefined}>{child}</View>)
      : children}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, flexGrow: 1 },
  list: { gap: theme.spacing.md },
  listWide: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '48.5%' },
});
