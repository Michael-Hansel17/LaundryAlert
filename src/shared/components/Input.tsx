import { forwardRef } from 'react';
import { Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
import { theme, ui } from '../theme/theme';

export const Input = forwardRef<TextInput, TextInputProps & { label: string; hint?: string }>(function Input({ label, hint, ...props }, ref) {
  return <View style={{ gap: theme.spacing.sm }}>
    <Text maxFontSizeMultiplier={1.6} style={[ui.body, { fontWeight: '600' }]}>{label}</Text>
    <TextInput ref={ref} accessibilityLabel={label} accessibilityHint={hint} maxFontSizeMultiplier={1.6} placeholderTextColor={theme.colors.muted} {...props}
      style={[styles.input, props.multiline && styles.multiline, props.style]} />
    {hint && <Text style={ui.muted}>{hint}</Text>}
  </View>;
});

const styles = StyleSheet.create({
  input: { minHeight: 50, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: theme.spacing.md, fontSize: theme.fontSize.body, color: theme.colors.text },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
});
