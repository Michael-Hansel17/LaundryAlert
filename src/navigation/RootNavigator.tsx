import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../features/auth/hooks/useAuth';
import { theme } from '../shared/theme/theme';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { ResidentNavigator } from './ResidentNavigator';

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: theme.colors.primary, background: theme.colors.background, card: theme.colors.surface, text: theme.colors.text, border: theme.colors.border },
};

export function RootNavigator() {
  const { user } = useAuth();
  return <NavigationContainer theme={navigationTheme}>
    {!user ? <AuthNavigator key="auth" /> : user.role === 'admin' ? <AdminNavigator key={user.id} /> : <ResidentNavigator key={user.id} />}
  </NavigationContainer>;
}
