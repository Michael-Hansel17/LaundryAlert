import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParams } from '../../../navigation/types';
import { Screen } from '../../../shared/components/Screen';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { AdminStatusView } from './AdminStatusView';
export function AdminDashboardScreen({ navigation }: NativeStackScreenProps<AdminStackParams, 'AdminDashboard'>) {
  const { controller, repository } = useAdminStatus();
  return <Screen><AdminStatusView controller={controller} onOpenOrder={(orderId) => navigation.navigate('AdminDetail', { orderId })}
    onSimulateLoadError={() => { repository.failNextLoad(); void controller.load(); }} /></Screen>;
}
