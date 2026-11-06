import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { queryClient } from '../client';
import {
  FOREGROUND_REVALIDATION_INTERVAL_MS,
  revalidateOnForeground,
  resetForegroundRevalidation,
} from '../revalidation';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  resetForegroundRevalidation();
  jest.restoreAllMocks();
});

afterEach(() => {
  resetForegroundRevalidation();
  jest.restoreAllMocks();
});

describe('revalidação de foreground', () => {
  it('ignora transições que não voltaram ao primeiro plano', async () => {
    const refetch = jest.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);

    await revalidateOnForeground('background', 10_000);
    await revalidateOnForeground('inactive', 10_001);

    expect(refetch).not.toHaveBeenCalled();
  });

  it('coalesce inactive/active e repete só depois da janela', async () => {
    const refetch = jest.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);

    await revalidateOnForeground('inactive', 10_000);
    await revalidateOnForeground('active', 10_001);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith({ type: 'active', stale: true }, { cancelRefetch: false });

    await revalidateOnForeground('active', 10_001 + FOREGROUND_REVALIDATION_INTERVAL_MS - 1);
    expect(refetch).toHaveBeenCalledTimes(1);

    await revalidateOnForeground('active', 10_001 + FOREGROUND_REVALIDATION_INTERVAL_MS);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('reaproveita a passagem em voo mesmo depois da janela', async () => {
    const running = deferred();
    const refetch = jest.spyOn(queryClient, 'refetchQueries').mockReturnValue(running.promise);

    const first = revalidateOnForeground('active', 10_000);
    expect(first).not.toBeNull();

    const second = revalidateOnForeground('active', 10_000 + FOREGROUND_REVALIDATION_INTERVAL_MS);
    expect(second).toBe(first);
    expect(refetch).toHaveBeenCalledTimes(1);

    running.resolve();
    await first;
    const next = revalidateOnForeground('active', 10_000 + FOREGROUND_REVALIDATION_INTERVAL_MS * 2);
    expect(next).not.toBeNull();
    expect(refetch).toHaveBeenCalledTimes(2);
    await next;
  });

  it('não deixa uma passagem antiga limpar a passagem atual', async () => {
    const firstPass = deferred();
    jest.spyOn(queryClient, 'refetchQueries')
      .mockReturnValueOnce(firstPass.promise)
      .mockResolvedValueOnce(undefined);

    const first = revalidateOnForeground('active', 10_000);
    firstPass.resolve();
    await first;

    await revalidateOnForeground('active', 10_000 + FOREGROUND_REVALIDATION_INTERVAL_MS * 2);
    expect(queryClient.refetchQueries).toHaveBeenCalledTimes(2);
  });
});
