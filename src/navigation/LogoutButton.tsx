import { useAuth } from '../features/auth/hooks/useAuth';
import { Button } from '../shared/components/Button';

export function LogoutButton() {
  const { signOut } = useAuth();
  return <Button title="Keluar" variant="ghost" onPress={() => { void signOut(); }} />;
}
