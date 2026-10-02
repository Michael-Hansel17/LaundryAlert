import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ResidentStackParams } from '../../../navigation/types';
import { Screen } from '../../../shared/components/Screen';
import { useLaundrySubmission } from '../hooks/useLaundrySubmission';
import { SubmitLaundryView } from './SubmitLaundryView';

export function SubmitLaundryScreen({ navigation }: NativeStackScreenProps<ResidentStackParams, 'SubmitLaundry'>) {
  const { controller, repository } = useLaundrySubmission();
  return <Screen><SubmitLaundryView controller={controller}
    onOpenOrder={(orderId) => navigation.replace('LaundryDetail', { orderId })}
    onSimulateLoadError={() => { repository.failNextLoad(); void controller.load(); }}
    onSimulateSubmitError={() => { repository.failNextSubmit(); void controller.submit(); }}
  /></Screen>;
}
