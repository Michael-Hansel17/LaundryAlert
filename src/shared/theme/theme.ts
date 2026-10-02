import { StyleSheet } from 'react-native';

export const theme = {
  colors: {
    primary: '#2458CE', primarySoft: '#EAF0FF', background: '#F4F6FA',
    surface: '#FFFFFF', text: '#19253B', muted: '#56657B', border: '#DCE3EF',
    danger: '#B42318', dangerSoft: '#FFF0ED', success: '#167247',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  fontSize: { caption: 13, body: 16, subtitle: 19, title: 26, display: 32 },
  radius: { sm: 10, md: 16, lg: 24 },
};

export const ui = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, gap: theme.spacing.md },
  title: { fontSize: theme.fontSize.title, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: theme.fontSize.subtitle, fontWeight: '700', color: theme.colors.text },
  body: { fontSize: theme.fontSize.body, color: theme.colors.text, lineHeight: 24 },
  muted: { fontSize: theme.fontSize.caption, color: theme.colors.muted, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  section: { gap: theme.spacing.md },
  error: { color: theme.colors.danger, backgroundColor: theme.colors.dangerSoft, padding: theme.spacing.md, borderRadius: theme.radius.sm, fontSize: theme.fontSize.body, lineHeight: 23 },
});
