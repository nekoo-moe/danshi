#!/usr/bin/env node
/**
 * CLI Entry point for Danser AutoFetch in TypeScript.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { parseReplay } from './parser';
import { BeatmapFetcher } from './fetcher';
import { SkinManager } from './skins';
import { DanserRenderer } from './renderer';
import { PPCalculator } from './calculator';
import { DanserInstaller } from './installer';
import { SystemPaths } from './types';

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

export function getDefaultPaths(): SystemPaths {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  let videosDir = path.join(home, 'Videos');
  if (process.platform === 'win32' && process.env.USERPROFILE) {
    videosDir = path.join(process.env.USERPROFILE, 'Videos');
  }
  const outputDir = path.join(videosDir, 'danser_records');

  let osuExportsDir = '';
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const appData = process.env.APPDATA || '';
    const candidates = [
      path.join(localAppData, 'osu!', 'exports'),
      path.join(localAppData, 'osu!', 'Exports'),
      path.join(appData, 'osu', 'exports'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        osuExportsDir = c;
        break;
      }
    }
    if (!osuExportsDir && localAppData) {
      osuExportsDir = path.join(localAppData, 'osu!', 'exports');
    }
  } else if (process.platform === 'darwin') {
    osuExportsDir = path.join(home, 'Library', 'Application Support', 'osu', 'exports');
  } else {
    const candidates = [
      path.join(home, '.var', 'app', 'sh.ppy.osu', 'data', 'osu', 'exports'),
      path.join(home, '.local', 'share', 'osu', 'exports'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        osuExportsDir = c;
        break;
      }
    }
    if (!osuExportsDir) {
      osuExportsDir = candidates[0];
    }
  }

  const danserDir = DanserRenderer.resolveDanserDir();
  return { danserDir, outputDir, osuExportsDir };
}

function printBanner(): void {
  console.log(`
==================================================================
   DANSER AUTOFETCH v${packageJson.version} (TypeScript / Node.js)
   Automated osu! Replay Video Renderer (Cross-Platform)
   GitHub: https://github.com/heiznerd/danser-autofetch
   NPM:    https://www.npmjs.com/package/danser-autofetch
==================================================================
`);
}

export async function run(): Promise<void> {
  const defaults = getDefaultPaths();

  const program = new Command();
  program
    .name('danser-autofetch')
    .description('Auto-fetch beatmaps and render osu! replay files (.osr) into 1080p 60FPS videos using Danser across Windows, Linux, and macOS.')
    .version(packageJson.version, '-v, --version', 'Output program version')
    .argument('[replay]', 'Path to the osu! replay file (.osr)')
    .option('-s, --skin <skin>', 'Skin name, local file path (.osk/.zip), folder path, or direct download URL')
    .option('--import-skin <pathOrUrl>', 'Import a new skin from a local path (.osk/.zip/folder) or download URL')
    .option('-d, --danser-dir <path>', 'Path to Danser directory', defaults.danserDir)
    .option('-o, --output-dir <path>', 'Directory to store output MP4 videos', defaults.outputDir)
    .option('--exports-dir <path>', 'osu! lazer exports directory', defaults.osuExportsDir)
    .option('--list-skins', 'List all available skins in Danser and exit')
    .option('--sync-skins', 'Manually sync skins from osu! exports and Downloads folders')
    .option('--fps <fps>', 'Output video framerate', (val) => parseInt(val, 10), 60)
    .allowUnknownOption(true);

  program.parse(process.argv);
  const options = program.opts();
  const replayArg = program.args[0];

  printBanner();

  // 1. Auto-detect or Auto-install Danser on first boot
  let danserDir = options.danserDir;
  try {
    danserDir = await DanserInstaller.ensureInstalled(options.danserDir);
  } catch (err: any) {
    console.error(`[ERROR] Failed to initialize Danser: ${err.message}`);
    process.exit(1);
  }

  const renderer = new DanserRenderer(danserDir, options.outputDir);
  
  // Ensure Danser configuration is pre-configured and written immediately
  renderer.configureSettings({
    useSkinCursor: true,
    useSkinHitsounds: true,
    useSkinColors: true,
    skipLeadIn: true,
    fps: options.fps,
  });

  const skinManager = new SkinManager(path.join(renderer.danserDir, 'Skins'), options.exportsDir);

  // 2. Explicit Skin Import
  if (options.importSkin) {
    const importedName = await skinManager.importSkin(options.importSkin);
    if (importedName) {
      console.log(`[SUCCESS] Added new skin: '${importedName}'`);
      console.log(`Usage: danser-record <replay.osr> -s "${importedName}"`);
    }
    return;
  }

  // 3. Manual Skin Sync
  if (options.syncSkins) {
    const imported = await skinManager.syncFromSources();
    console.log(`[INFO] Synchronized ${imported} skin(s) from system folders into Danser.`);
    return;
  }

  // 4. List Skins
  if (options.listSkins) {
    const skins = skinManager.listSkins();
    if (skins.length > 0) {
      console.log(`Available Skins (${skins.length} total):`);
      for (const s of skins.sort()) {
        console.log(`  - ${s}`);
      }
    } else {
      console.log('No custom skins installed yet. Add one with: danser-record --import-skin <path/to/skin.osk>');
    }
    return;
  }

  if (!replayArg) {
    program.help();
    process.exit(1);
  }

  const cleanReplay = replayArg.trim().replace(/^["']|["']$/g, '');
  const replayPath = path.resolve(cleanReplay.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));

  if (!fs.existsSync(replayPath)) {
    console.error(`[ERROR] Replay file not found: ${replayPath}`);
    process.exit(1);
  }

  console.log(`Analyzing Replay: ${path.basename(replayPath)}`);
  let replayInfo: any = {};
  try {
    replayInfo = parseReplay(replayPath);
    console.log(`Player:      ${replayInfo.playerName}`);
    console.log(`Mods:        ${replayInfo.modsString}`);
    console.log(`Score:       ${replayInfo.totalScore.toLocaleString()} | Max Combo: ${replayInfo.maxCombo}x`);
    console.log(`Beatmap MD5: ${replayInfo.beatmapMd5}`);
  } catch (e: any) {
    console.warn(`[WARN] Could not parse replay header: ${e.message}`);
  }

  const songsDir = path.join(renderer.danserDir, 'Songs');
  if (replayInfo.beatmapMd5) {
    const fetcher = new BeatmapFetcher(songsDir);
    const { success, message } = await fetcher.ensureBeatmap(replayInfo.beatmapMd5, replayPath);
    console.log(`Beatmap Status: ${message}`);
    if (!success) {
      console.warn('[WARN] Beatmap could not be auto-downloaded. Proceeding with existing local database...');
    }
  }

  // Calculate 2026 PP Performance Points
  const meta = new BeatmapFetcher(songsDir).parseReplayFilename(replayPath);
  const osuFile = PPCalculator.findOsuFileInSongs(songsDir, replayInfo.beatmapMd5, meta.diff);
  if (osuFile) {
    const ppResult = PPCalculator.calculate(osuFile, replayInfo);
    if (ppResult) {
      console.log(`\n==================================================================`);
      console.log(`2026 Performance Points Breakdown (Latest July 2026 Rework)`);
      console.log(`Star Rating:    ${ppResult.stars}* (Aim: ${ppResult.aimStars}* | Speed: ${ppResult.speedStars}*)`);
      console.log(`Performance:    ${ppResult.totalPP} PP (Aim: ${ppResult.aimPP} | Speed: ${ppResult.speedPP} | Acc: ${ppResult.accPP})`);
      console.log(`If 100% SS:     ${ppResult.ssPP} PP (Max Combo: ${ppResult.maxCombo}x)`);
      console.log(`==================================================================`);
    }
  }

  // Skin matching or on-the-fly import
  let selectedSkin: string | undefined;
  if (options.skin) {
    const matched = await skinManager.matchSkin(options.skin);
    if (matched) {
      selectedSkin = matched;
      console.log(`Using Skin: '${selectedSkin}'`);
    } else {
      selectedSkin = options.skin;
      console.log(`Using Custom Skin: '${selectedSkin}'`);
    }
  }

  const startTime = Date.now();
  const exitCode = await renderer.runRecord(replayPath, selectedSkin, program.args.slice(1));

  let videoGenerated = false;
  if (fs.existsSync(renderer.outputDir)) {
    const files = fs.readdirSync(renderer.outputDir);
    for (const f of files) {
      if (f.endsWith('.mp4')) {
        const fullP = path.join(renderer.outputDir, f);
        const mtime = fs.statSync(fullP).mtimeMs;
        if (mtime >= startTime - 2000) {
          videoGenerated = true;
          break;
        }
      }
    }
  }

  if (exitCode === 0 && videoGenerated) {
    console.log('\n' + '='.repeat(66));
    console.log('Rendering Complete! Video saved to:');
    console.log(`Destination: ${renderer.outputDir}`);
    console.log('='.repeat(66));
  } else {
    console.log('\n' + '='.repeat(66));
    console.log('[ERROR] Rendering ended without producing a video.');
    console.log("If the beatmap was not found, please ensure the beatmap (.osz) is in Danser's Songs folder.");
    console.log('='.repeat(66));
    process.exit(exitCode === 0 ? 1 : exitCode);
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}
