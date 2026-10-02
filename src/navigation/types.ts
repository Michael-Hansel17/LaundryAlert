import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParams = { Login: undefined; Register: undefined };
export type ResidentTabParams = { Dashboard: undefined; History: undefined };
export type ResidentStackParams = {
  ResidentTabs: NavigatorScreenParams<ResidentTabParams> | undefined;
  SubmitLaundry: undefined;
  LaundryDetail: { orderId: string };
};
export type AdminStackParams = { AdminDashboard: undefined; AdminDetail: { orderId: string } };
