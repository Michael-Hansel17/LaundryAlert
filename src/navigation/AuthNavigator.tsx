import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../features/auth/presentation/LoginScreen';
import { RegisterScreen } from '../features/auth/presentation/RegisterScreen';
import { DiagnosticsScreen } from '../shared/presentation/DiagnosticsScreen';
import { LogButton } from './HeaderActions';
import type { AuthStackParams } from './types';

const Stack = createNativeStackNavigator<AuthStackParams>();
export function AuthNavigator() {
  return <Stack.Navigator>
    <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'LaundryAlert', headerRight: () => <LogButton /> }} />
    <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Registrasi' }} />
    <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: 'Log diagnostik' }} />
  </Stack.Navigator>;
}
