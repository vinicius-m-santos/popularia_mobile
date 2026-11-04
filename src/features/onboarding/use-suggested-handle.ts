import { useEffect, useRef } from 'react';

import { suggestHandle } from './api';

type SuggestInput = {
  account: unknown;
  handle: string;
  update: (patch: { handle: string }) => void;
};

/** Preenche o @ vazio do cadastro comum com uma sugestão legível do servidor. */
export function useSuggestedHandle({ account, handle, update }: SuggestInput): void {
  const requested = useRef(false);

  useEffect(() => {
    if (account || handle || requested.current) return;
    requested.current = true;
    let active = true;
    suggestHandle().then(
      (suggestion) => {
        if (!active) return;
        if (!handle) update({ handle: suggestion });
      },
      () => { if (active) requested.current = false; },
    );
    return () => { active = false; };
  }, [account, handle, update]);
}
