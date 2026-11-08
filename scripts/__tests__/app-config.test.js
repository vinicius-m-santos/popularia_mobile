/**
 * POP-66 — o A/B de Compiler não pode vazar para produção/staging.
 *
 * O `app.config.js` roda no build (EAS/Expo CLI), não no app. Estes testes
 * chamam a mesma função com os perfis reais e conferem a decisão final.
 */
const path = require('node:path');

const CONFIG_PATH = path.resolve(__dirname, '../../app.config.js');
const ENV_KEYS = [
  'EAS_BUILD_PROFILE',
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_REACT_COMPILER',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SENTRY_ENVIRONMENT',
  'EXPO_PUBLIC_LINK_ORIGIN',
];

const BASE_CONFIG = {
  name: 'Popularia',
  slug: 'popularia_mobile',
  ios: {},
  android: {},
  plugins: [],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {},
};

function loadConfig(env) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try {
    jest.resetModules();
    return require(CONFIG_PATH)({ config: BASE_CONFIG });
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

describe('POP-66 — config de build do React Compiler', () => {
  it('mantém o Compiler ligado por padrão', () => {
    const config = loadConfig({});
    expect(config.experiments.reactCompiler).toBe(true);
    expect(config.extra.reactCompiler).toBe(true);
  });

  it('permite desligar apenas em build de desenvolvimento', () => {
    const config = loadConfig({
      EAS_BUILD_PROFILE: 'development',
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_REACT_COMPILER: '0',
    });
    expect(config.experiments.reactCompiler).toBe(false);
    expect(config.extra.reactCompiler).toBe(false);
  });

  it('recusa desligar em produção', () => {
    expect(() => loadConfig({
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_REACT_COMPILER: '0',
    })).toThrow(/comparação de desenvolvimento/);
  });

  it('recusa desligar em staging/TestFlight', () => {
    expect(() => loadConfig({
      EAS_BUILD_PROFILE: 'staging',
      EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_REACT_COMPILER: '0',
    })).toThrow(/comparação de desenvolvimento/);
    expect(() => loadConfig({
      EAS_BUILD_PROFILE: 'testflight-staging',
      EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_REACT_COMPILER: '0',
    })).toThrow(/comparação de desenvolvimento/);
  });

  it('recusa desligar quando o ambiente não é desenvolvimento', () => {
    expect(() => loadConfig({
      EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_REACT_COMPILER: '0',
    })).toThrow(/comparação de desenvolvimento/);
  });

  it('recusa valor ambíguo em vez de desligar por acidente', () => {
    expect(() => loadConfig({ EXPO_PUBLIC_REACT_COMPILER: 'false' }))
      .toThrow(/EXPO_PUBLIC_REACT_COMPILER/);
  });
});
