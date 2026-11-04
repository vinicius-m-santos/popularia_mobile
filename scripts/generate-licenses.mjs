#!/usr/bin/env node
/**
 * Gera src/features/legal/licenses.generated.ts a partir das dependências diretas
 * instaladas e das fontes embarcadas no app.
 *
 * Rode com `npm run licenses` sempre que as dependências ou as fontes mudarem.
 * A lista cobre as dependências de runtime declaradas em package.json; o texto
 * completo de cada licença continua no pacote original.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const pkg = readJson(join(root, 'package.json'));

// Fontes carregadas em src/app/_layout.tsx. Todas são SIL Open Font License 1.1.
const FONTS = [
  { name: 'Anton', license: 'SIL OFL 1.1' },
  { name: 'Archivo', license: 'SIL OFL 1.1' },
  { name: 'Archivo Narrow', license: 'SIL OFL 1.1' },
  { name: 'IBM Plex Mono', license: 'SIL OFL 1.1' },
];

const licenseOf = (manifest) => {
  if (typeof manifest.license === 'string' && manifest.license.trim()) return manifest.license.trim();
  if (Array.isArray(manifest.licenses)) {
    const types = manifest.licenses.map((entry) => entry?.type).filter(Boolean);
    if (types.length > 0) return types.join(', ');
  }
  return 'Não declarada';
};

const libraries = Object.keys(pkg.dependencies ?? {})
  .sort((a, b) => a.localeCompare(b))
  .map((name) => {
    const manifestPath = join(root, 'node_modules', name, 'package.json');
    if (!existsSync(manifestPath)) return { name, license: 'Não instalada' };
    const manifest = readJson(manifestPath);
    return { name, version: manifest.version, license: licenseOf(manifest) };
  });

const content = `// Arquivo gerado por \`npm run licenses\` (scripts/generate-licenses.mjs).
// Não edite à mão: rode o script para atualizar a lista.

export type LicenseEntry = {
  name: string;
  version?: string;
  license: string;
};

/** Fontes embarcadas no app (SIL Open Font License 1.1). */
export const FONT_LICENSES: LicenseEntry[] = ${JSON.stringify(FONTS, null, 2)};

/** Dependências diretas de runtime declaradas em package.json. */
export const LIBRARY_LICENSES: LicenseEntry[] = ${JSON.stringify(libraries, null, 2)};
`;

writeFileSync(join(root, 'src/features/legal/licenses.generated.ts'), content);
console.log(`licenses.generated.ts: ${FONTS.length} fontes, ${libraries.length} bibliotecas`);
