const app = require('../../../app.json');

const {
  compileFile,
  compileSource,
  compilerCacheCount,
  functionHasCompilerCache,
  hasCompilerRuntime,
} = require('../compile');

const TARGETS = [
  { file: 'src/components/app-text.tsx', function: 'AppText' },
  { file: 'src/features/posts/components/post-card.tsx', function: 'PostCardView' },
  { file: 'src/features/profiles/components/profile-media-grid.tsx', function: 'ProfileMediaGrid' },
  { file: 'src/features/profiles/profile-screen.tsx', function: 'ProfileScreen' },
  { file: 'src/features/explore/explore-screen.tsx', function: 'DiscoveryScreen' },
];

function probe(dependenciesLine) {
  return `
import { useMemo } from 'react';
import { Text } from 'react-native';
export function Probe({ values }) {
  const key = values.join(',');
  const stable = useMemo(() => values.slice(), ${dependenciesLine});
  return <Text>{stable.join('')}</Text>;
}
`;
}

describe('POP-66 — auditoria do React Compiler', () => {
  it('mantém o Compiler ligado na base de produção', () => {
    expect(app.expo.experiments.reactCompiler).toBe(true);
  });

  it('compila os hotspots da auditoria com memo cache', () => {
    for (const target of TARGETS) {
      const code = compileFile(target.file, true);
      expect({ file: target.file, compiled: hasCompilerRuntime(code) && functionHasCompilerCache(code, target.function) })
        .toEqual({ file: target.file, compiled: true });
      expect(compilerCacheCount(code)).toBeGreaterThan(0);
    }
  });

  it('não inclui runtime de memo cache quando o Compiler está desligado', () => {
    const code = compileFile('src/components/app-text.tsx', false);
    expect(hasCompilerRuntime(code)).toBe(false);
    expect(compilerCacheCount(code)).toBe(0);
  });

  it('documenta o bailout de useMemo com dependências divergentes', () => {
    const mismatched = compileSource(probe('[key]'), { filename: 'probe-mismatch.jsx', compiler: true });
    const matched = compileSource(probe('[values]'), { filename: 'probe-matched.jsx', compiler: true });

    expect(hasCompilerRuntime(mismatched)).toBe(false);
    expect(hasCompilerRuntime(matched)).toBe(true);
  });
});
