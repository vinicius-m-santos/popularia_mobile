/**
 * Compila uma fonte com o mesmo preset do Metro, ligando e desligando o React
 * Compiler pelo `caller`. É a base do auditor e do benchmark A/B do POP-66.
 *
 * Não é um build de release: o Jest/Metro real define `caller` e plataforma por
 * conta própria. Aqui o objetivo é reproduzir a decisão do plugin (compilou ou
 * não) e inspecionar o memo cache gerado.
 */
const fs = require('node:fs');
const path = require('node:path');

const babel = require('@babel/core');
const expoPreset = require('expo/internal/babel-preset');

const ROOT = path.resolve(__dirname, '../..');

/**
 * @param {string} source
 * @param {{ filename?: string, compiler?: boolean, platform?: string, production?: boolean }} [options]
 * @returns {string}
 */
function compileSource(source, options = {}) {
  const {
    filename = 'fixture.jsx',
    compiler = false,
    platform = 'ios',
    production = true,
  } = options;
  const result = babel.transformSync(source, {
    filename,
    presets: [[expoPreset, {}]],
    caller: {
      name: 'metro',
      bundler: 'metro',
      platform,
      supportsReactCompiler: compiler,
      isDev: !production,
      isProduction: production,
      isServer: false,
      isReactServer: false,
      isNodeModule: false,
    },
    babelrc: false,
    configFile: false,
    compact: false,
  });
  return result?.code ?? '';
}

/**
 * @param {string} relativePath caminho relativo à raiz do app
 * @param {boolean} compiler
 * @returns {string}
 */
function compileFile(relativePath, compiler) {
  const absolute = path.resolve(ROOT, relativePath);
  return compileSource(fs.readFileSync(absolute, 'utf8'), { filename: absolute, compiler });
}

function hasCompilerRuntime(code) {
  return code.includes('react/compiler-runtime') && /compilerRuntime\.c\b/.test(code);
}

function compilerCacheCount(code) {
  return (code.match(/compilerRuntime\.c\b/g) ?? []).length;
}

/**
 * Confere se uma função específica recebeu memo cache. O arquivo inteiro pode
 * compilar (componentes auxiliares) enquanto a tela principal sofre bailout.
 */
function functionHasCompilerCache(code, functionName) {
  const start = code.indexOf(`function ${functionName}(`);
  if (start === -1) return false;
  return /compilerRuntime\.c\b/.test(code.slice(start, start + 1_200));
}

module.exports = {
  ROOT,
  compileSource,
  compileFile,
  hasCompilerRuntime,
  compilerCacheCount,
  functionHasCompilerCache,
};
