import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../features/laundry/presentation/DashboardScreen';
import { HistoryScreen } from '../features/laundry/presentation/HistoryScreen';
import { LaundryDetailScreen } from '../features/laundry/presentation/LaundryDetailScreen';
import { SubmitLaundryScreen } from '../features/laundry/presentation/SubmitLaundryScreen';
import { ResidentSyncProvider } from '../features/laundry/state/ResidentSync';
import { theme } from '../shared/theme/theme';
import { LogoutButton } from './LogoutButton';
import type { ResidentStackParams, ResidentTabParams } from './types';

const Stack = createNativeStackNavigator<ResidentStackParams>();
const Tabs = createBottomTabNavigator<ResidentTabParams>();

function ResidentTabs() {
  const insets = useSafeAreaInsets();
  return <Tabs.Navigator screenOptions={({ route }) => ({
    headerRight: () => <LogoutButton />,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.muted,
    tabBarLabelStyle: { fontSize: theme.fontSize.caption, lineHeight: 18, flexShrink: 0 },
    tabBarStyle: { height: 72 + insets.bottom, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 4) },
    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24, lineHeight: 24 }}>{route.name === 'Dashboard' ? '⌂' : '≡'}</Text>,
  })}>
    <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Beranda' }} />
    <Tabs.Screen name="History" component={HistoryScreen} options={{ title: 'Riwayat' }} />
  </Tabs.Navigator>;
}

export function ResidentNavigator() {
  return <ResidentSyncProvider><Stack.Navigator>
    <Stack.Screen name="ResidentTabs" component={ResidentTabs} options={{ headerShown: false }} />
    <Stack.Screen name="SubmitLaundry" component={SubmitLaundryScreen} options={{ title: 'Pengajuan laundry' }} />
    <Stack.Screen name="LaundryDetail" component={LaundryDetailScreen} options={{ title: 'Detail laundry' }} />
  </Stack.Navigator></ResidentSyncProvider>;
}
