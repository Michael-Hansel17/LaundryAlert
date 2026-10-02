import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminDashboardScreen } from '../features/admin/presentation/AdminDashboardScreen';
import { AdminDetailScreen } from '../features/admin/presentation/AdminDetailScreen';
import { LogoutButton } from './LogoutButton';
import type { AdminStackParams } from './types';

const Stack = createNativeStackNavigator<AdminStackParams>();
export function AdminNavigator() {
  return <Stack.Navigator>
    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin LaundryAlert', headerRight: () => <LogoutButton /> }} />
    <Stack.Screen name="AdminDetail" component={AdminDetailScreen} options={{ title: 'Kelola laundry' }} />
  </Stack.Navigator>;
}
