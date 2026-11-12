import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '../utils/format';

// Submit status for a form: busy flag, error text, and a double-submit guard.
// The form only renders inputs and this status; the action holds validation + the repository call.
// On success busy stays true because a successful auth action navigates away from the screen.
export function useFormSubmit<Args extends unknown[]>(action: (...args: Args) => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const submit = useCallback(async (...args: Args) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setError('');
    try {
      await action(...args);
    } catch (e) {
      running.current = false;
      setError(errorMessage(e)); setBusy(false);
    }
  }, [action]);
  return { busy, error, submit };
}
