#!/usr/bin/env node
/**
 * POP-66 — auditoria estática do React Compiler.
 *
 * Compila os hotspots da auditoria com o mesmo preset do app e confere se cada
 * componente recebeu memo cache. O arquivo pode ter componentes auxiliares
 * compilados enquanto a tela principal sofre bailout; por isso a checagem é por
 * função, não só por arquivo.
 *
 * Uso: npm run audit:react-compiler
 */
const fs = require('node:fs');
const path = require('node:path');

const {
  ROOT,
  compileFile,
  compilerCacheCount,
  functionHasCompilerCache,
  hasCompilerRuntime,
} = require('./compile');

const TARGETS = [
  { file: 'src/components/app-text.tsx', function: 'AppText' },
  { file: 'src/features/posts/components/post-card.tsx', function: 'PostCardView' },
  { file: 'src/features/profiles/components/profile-media-grid.tsx', function: 'ProfileMediaGrid' },
  { file: 'src/features/profiles/profile-screen.tsx', function: 'ProfileScreen' },
  { file: 'src/features/explore/explore-screen.tsx', function: 'DiscoveryScreen' },
];

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function audit() {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const compilerEnabled = app?.expo?.experiments?.reactCompiler === true;
  const rows = TARGETS.map((target) => {
    const compiled = compileFile(target.file, true);
    const plain = compileFile(target.file, false);
    return {
      ...target,
      compiled: hasCompilerRuntime(compiled) && functionHasCompilerCache(compiled, target.function),
      memoCaches: compilerCacheCount(compiled),
      manualHooksLeft: (compiled.match(/\buse(?:Memo|Callback)\b/g) ?? []).length,
      plainHooks: (plain.match(/\buse(?:Memo|Callback)\b/g) ?? []).length,
    };
  });

  console.log('POP-66 — React Compiler nos hotspots da auditoria');
  console.log(`app.json experiments.reactCompiler: ${compilerEnabled ? 'true' : 'false'}`);
  console.log('');
  console.log(
    `${pad('arquivo', 58)} ${pad('função', 18)} ${pad('compilou', 9)} ${pad('caches', 11)} ${pad('useMemo/useCallback no output', 28)}`,
  );
  for (const row of rows) {
    console.log(
      `${pad(row.file, 58)} ${pad(row.function, 18)} ${pad(row.compiled ? 'sim' : 'NÃO', 9)} ${pad(row.memoCaches, 11)} ${pad(`${row.manualHooksLeft} (fonte: ${row.plainHooks})`, 28)}`,
    );
  }
  console.log('');
  console.log('Leitura: o Compiler remove useMemo/useCallback do output dos componentes que compila.');
  console.log('Caches de módulo (tokenizePostText, callSchedule, mediaGridData) não aparecem aqui');
  console.log('porque são compartilhados entre instâncias/remontagens, algo que o memo cache por');
  console.log('componente não cobre. O benchmark POP-66 mede esses dois casos.');

  const failed = rows.filter((row) => !row.compiled);
  if (!compilerEnabled) {
    console.error('\nFAIL: experiments.reactCompiler precisa continuar true na base de produção.');
  }
  if (failed.length > 0) {
    console.error(`\nFAIL: sem memo cache em ${failed.map((row) => `${row.function} (${row.file})`).join(', ')}.`);
  }
  if (!compilerEnabled || failed.length > 0) process.exitCode = 1;
}

audit();
