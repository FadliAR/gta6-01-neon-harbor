// NEON HARBOR — entrypoint. Node 22, stdlib only, deterministic.
// Copies game/ + screenshots/ to the output dir and writes dossier.json
// via the kit's unchanged vendor/makefun-game.ts buildDossier.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

function main(): void {
  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/ missing next to main.ts');
  if (!existsSync(shotsSrc)) throw new Error('screenshots/ missing next to main.ts');
  mkdirSync(outDir, { recursive: true });
  // start from a clean output so the two grader runs are identical
  for (const name of ['game', 'screenshots', 'dossier.json']) {
    const p = join(outDir, name);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
  copyTree(gameSrc, join(outDir, 'game'));
  copyTree(shotsSrc, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
