import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '../index';
import { withPerformanceProfiler } from '../profiler';

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

function Card({ label }: { label: string }) {
  return <Text>{label}</Text>;
}
const ProfiledCard = withPerformanceProfiler('TestCard', Card);

beforeEach(() => {
  process.env.EXPO_PUBLIC_APP_ENV = 'development';
  setPerformanceInstrumentationOverride(true);
  resetPerformanceSession();
});

afterEach(() => {
  setPerformanceInstrumentationOverride(null);
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
});

describe('React Profiler da instrumentação', () => {
  it('conta commits de mount e update na mesma instância', async () => {
    const view = await render(<ProfiledCard label="um" />);
    await view.rerender(<ProfiledCard label="dois" />);

    const [record] = getPerformanceSnapshot().commits;
    expect(record.component).toBe('TestCard');
    expect(record.mountCommits).toBe(1);
    expect(record.updateCommits).toBeGreaterThanOrEqual(1);
    expect(record.commits).toBe(record.mountCommits + record.updateCommits);
  });

  it('não envolve nem registra nada quando o gate está fechado', async () => {
    setPerformanceInstrumentationOverride(false);
    await render(<ProfiledCard label="um" />);
    expect(getPerformanceSnapshot().commits).toHaveLength(0);
    expect(getPerformanceSnapshot().enabled).toBe(false);
  });
});
