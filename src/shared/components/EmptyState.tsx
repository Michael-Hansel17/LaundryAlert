import { Text, View } from 'react-native';
import { ui } from '../theme/theme';

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <View style={ui.card}><Text style={ui.subtitle}>{title}</Text><Text style={ui.muted}>{message}</Text></View>;
}
