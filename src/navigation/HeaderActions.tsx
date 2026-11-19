import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../shared/components/Button';
import { LogoutButton } from './LogoutButton';

// "Log" opens the diagnostics screen of the current stack; every stack registers a Diagnostics route.
export function LogButton() {
  const navigation = useNavigation();
  return <Button title="Log" variant="ghost" hint="Buka log diagnostik" onPress={() => navigation.navigate('Diagnostics' as never)} />;
}

export function HeaderActions() {
  return <View style={{ flexDirection: 'row' }}><LogButton /><LogoutButton /></View>;
}
