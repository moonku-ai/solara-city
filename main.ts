// Solara City — the entry program (Node 22, standard library only).
// It gathers game/ and screenshots/ from beside this file into the output
// directory (MAKEFUN_OUTPUT_DIR, or /output in the grader) and writes the
// dossier the judge reads, using the vendored make.fun library.
//
// Run it locally like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the playable game and its screenshots into the output directory.
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's own caps: the dossier text is capped at 160 KiB; the other caps
// only refuse an entry the scorer would refuse (at most 4 screenshots, each
// at most 256 KiB; game/ at most 993 files and 48 MiB in all; no path under
// game/ longer than 1000 bytes).
const dossierBytes = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);
console.log(`Solara City dossier written to ${join(outDir, 'dossier.json')}`);
