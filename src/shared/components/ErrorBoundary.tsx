import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { logger } from '../services/logger';
import { theme, ui } from '../theme/theme';
import { Button } from './Button';

interface State { error: Error | null }

// Last line of defence for render errors: logs them and offers a retry instead of a blank screen.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('crash', 'Error saat menampilkan layar', { error, componentStack: info.componentStack ?? undefined });
    void logger.flush();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.lg, backgroundColor: theme.colors.background }}>
      <Text accessibilityRole="header" style={ui.title}>Terjadi kesalahan</Text>
      <Text style={ui.body}>Aplikasi mengalami error. Detailnya sudah dicatat di Log diagnostik.</Text>
      <Text style={ui.error}>{this.state.error.message}</Text>
      <Button title="Muat ulang tampilan" onPress={() => this.setState({ error: null })} />
    </View>;
  }
}
