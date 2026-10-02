import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DemoProvider } from './src/shared/state/DemoProvider';

export default function App() {
  return <SafeAreaProvider><DemoProvider><StatusBar style="dark" /><RootNavigator /></DemoProvider></SafeAreaProvider>;
}
