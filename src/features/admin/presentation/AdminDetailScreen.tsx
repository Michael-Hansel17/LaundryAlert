import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParams } from '../../../navigation/types';
import { Screen } from '../../../shared/components/Screen';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { AdminStatusView } from './AdminStatusView';
export function AdminDetailScreen({ route }: NativeStackScreenProps<AdminStackParams, 'AdminDetail'>) {
  const { controller, repository } = useAdminStatus(route.params.orderId);
  return <Screen><AdminStatusView controller={controller}
    onSimulateLoadError={() => { repository.failNextLoad(); void controller.load(); }}
    onSimulateSubmitError={() => { repository.failNextUpdate(); void controller.submit(); }} /></Screen>;
}
