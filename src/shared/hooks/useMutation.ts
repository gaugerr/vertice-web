import {useRef, useState} from 'react';
import {errorMessage} from '../lib/errors';

export function useMutation() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run<T>(action: () => Promise<T>): Promise<{ok: true; value: T} | {ok: false}> {
    if (lock.current) return {ok: false};
    lock.current = true; setPending(true); setError('');
    try {return {ok: true, value: await action()}}
    catch (cause) {setError(errorMessage(cause)); return {ok: false}}
    finally {lock.current = false; setPending(false)}
  }
  return {pending, error, run};
}
