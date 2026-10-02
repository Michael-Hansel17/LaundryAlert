import { Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
import { theme, ui } from '../theme/theme';

export function Input({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={{ gap: theme.spacing.sm }}>
    <Text style={[ui.body, { fontWeight: '600' }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={theme.colors.muted} {...props}
      style={[styles.input, props.multiline && styles.multiline, props.style]} />
    {hint && <Text style={ui.muted}>{hint}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  input: { minHeight: 50, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: theme.spacing.md, fontSize: theme.fontSize.body, color: theme.colors.text },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
});
