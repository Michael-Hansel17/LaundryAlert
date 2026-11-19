import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/shared/components/ErrorBoundary';
import { setupAppLogging } from './src/shared/services/appLogSetup';
import { DemoProvider } from './src/shared/state/DemoProvider';

setupAppLogging();

export default function App() {
  return <SafeAreaProvider><ErrorBoundary><DemoProvider><StatusBar style="dark" /><RootNavigator /></DemoProvider></ErrorBoundary></SafeAreaProvider>;
}
