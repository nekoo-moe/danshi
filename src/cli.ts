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

export function parseResolution(input?: string): [number, number] {
  if (!input) return [1920, 1080];
  const clean = input.toLowerCase().trim();

  const presets: Record<string, [number, number]> = {
    '480p': [854, 480],
    '480': [854, 480],
    '720p': [1280, 720],
    '720': [1280, 720],
    'hd': [1280, 720],
    '1080p': [1920, 1080],
    '1080': [1920, 1080],
    'fhd': [1920, 1080],
    '1440p': [2560, 1440],
    '1440': [2560, 1440],
    '2k': [2560, 1440],
    'qhd': [2560, 1440],
    '4k': [3840, 2160],
    '2160p': [3840, 2160],
    '2160': [3840, 2160],
    'uhd': [3840, 2160],
  };

  if (presets[clean]) {
    return presets[clean];
  }

  const match = clean.match(/^(\d+)[xX*:](\d+)$/);
  if (match) {
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    if (w > 0 && h > 0) {
      return [w, h];
    }
  }

  console.warn(`[WARN] Unknown resolution preset '${input}', defaulting to 1080p (1920x1080).`);
  return [1920, 1080];
}

export function resolveReplayPath(arg?: string, osuExportsDir?: string, danserDir?: string): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidateDirs: string[] = [];

  if (osuExportsDir && fs.existsSync(osuExportsDir)) {
    candidateDirs.push(osuExportsDir);
  }
  const downloadsDir = path.join(home, 'Downloads');
  if (fs.existsSync(downloadsDir)) {
    candidateDirs.push(downloadsDir);
    // Include common download subfolders like Telegram Desktop
    try {
      for (const sub of fs.readdirSync(downloadsDir)) {
        const subPath = path.join(downloadsDir, sub);
        if (fs.statSync(subPath).isDirectory() && !sub.startsWith('.')) {
          candidateDirs.push(subPath);
        }
      }
    } catch {}
  }
  const documentsDir = path.join(home, 'Documents');
  if (fs.existsSync(documentsDir)) {
    candidateDirs.push(documentsDir);
  }
  const desktopDir = path.join(home, 'Desktop');
  if (fs.existsSync(desktopDir)) {
    candidateDirs.push(desktopDir);
  }
  if (danserDir) {
    const replaysDir = path.join(danserDir, 'Replays');
    if (fs.existsSync(replaysDir)) {
      candidateDirs.push(replaysDir);
    }
  }

  // If no argument provided, find the newest .osr replay across candidate folders
  if (!arg) {
    let latestPath: string | null = null;
    let latestMtime = 0;
    for (const dir of candidateDirs) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.toLowerCase().endsWith('.osr')) {
            const fullP = path.join(dir, f);
            const mtime = fs.statSync(fullP).mtimeMs;
            if (mtime > latestMtime) {
              latestMtime = mtime;
              latestPath = fullP;
            }
          }
        }
      } catch {}
    }
    return latestPath;
  }

  const cleanArg = arg.trim().replace(/^["']|["']$/g, '');

  // 1. Direct path as passed (absolute or relative to cwd)
  const resolved = path.resolve(cleanArg.replace(/^~(?=$|\/|\\)/, home));
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
    return resolved;
  }

  // 1.1 Direct path with .osr appended
  if (!cleanArg.toLowerCase().endsWith('.osr')) {
    const resolvedWithOsr = path.resolve((cleanArg + '.osr').replace(/^~(?=$|\/|\\)/, home));
    if (fs.existsSync(resolvedWithOsr) && !fs.statSync(resolvedWithOsr).isDirectory()) {
      return resolvedWithOsr;
    }
  }

  // 2. Exact filename match in candidate directories
  for (const dir of candidateDirs) {
    const target = path.join(dir, cleanArg);
    if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) {
      return target;
    }
    if (!cleanArg.toLowerCase().endsWith('.osr')) {
      const targetWithOsr = path.join(dir, `${cleanArg}.osr`);
      if (fs.existsSync(targetWithOsr) && !fs.statSync(targetWithOsr).isDirectory()) {
        return targetWithOsr;
      }
    }
  }

  // 3. Substring / Fuzzy match in candidate directories (sorted by newest modified)
  const searchBase = cleanArg.replace(/\.osr$/i, '').toLowerCase();
  for (const dir of candidateDirs) {
    try {
      const files = fs.readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.osr'))
        .map((f) => {
          const fullP = path.join(dir, f);
          return { fullP, filename: f, mtime: fs.statSync(fullP).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      for (const item of files) {
        if (item.filename.toLowerCase().includes(searchBase)) {
          return item.fullP;
        }
      }
    } catch {}
  }

  return null;
}

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
    .description('Auto-fetch beatmaps and render osu! replay files (.osr) into MP4 videos using Danser across Windows, Linux, and macOS.')
    .version(packageJson.version, '-v, --version', 'Output program version')
    .argument('[replay]', 'Path to the osu! replay file (.osr)')
    .option('-s, --skin <skin>', 'Skin name, local file path (.osk/.zip), folder path, or direct download URL')
    .option('-r, --resolution <resolution>', 'Output video resolution: 480p, 720p, 1080p, 1440p (2K), 4K, or custom WxH (e.g. 1920x1080)', '1080p')
    .option('--fps <fps>', 'Output video framerate (e.g. 30, 60, 120)', (val) => parseInt(val, 10), 60)
    .option('--import-skin <pathOrUrl>', 'Import a new skin from a local path (.osk/.zip/folder) or download URL')
    .option('-d, --danser-dir <path>', 'Path to Danser directory', defaults.danserDir)
    .option('-o, --output-dir <path>', 'Directory to store output MP4 videos', defaults.outputDir)
    .option('--exports-dir <path>', 'osu! lazer exports directory', defaults.osuExportsDir)
    .option('--list-skins', 'List all available skins in Danser and exit')
    .option('--sync-skins', 'Manually sync skins from osu! exports and Downloads folders')
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
  const resolution = parseResolution(options.resolution);

  // Ensure Danser configuration is pre-configured and written immediately
  renderer.configureSettings({
    useSkinCursor: true,
    useSkinHitsounds: true,
    useSkinColors: true,
    skipLeadIn: true,
    fps: options.fps,
    resolution,
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

  let replayPath: string | null = null;
  if (replayArg) {
    replayPath = resolveReplayPath(replayArg, options.exportsDir, renderer.danserDir);
    if (!replayPath) {
      console.error(`[ERROR] Replay file not found: '${replayArg}'`);
      console.error(`Searched in: Current directory, Downloads, Documents, Desktop, and osu! exports folder.`);
      process.exit(1);
    }
    const cleanReplay = replayArg.trim().replace(/^["']|["']$/g, '');
    if (path.resolve(cleanReplay) !== path.resolve(replayPath)) {
      console.log(`[RESOLVE] Auto-located replay file: ${replayPath}`);
    }
  } else {
    // If no replay argument was provided, try picking the newest replay automatically
    replayPath = resolveReplayPath(undefined, options.exportsDir, renderer.danserDir);
    if (replayPath) {
      console.log(`[AUTO-DETECT] No replay specified, using newest replay found: ${path.basename(replayPath)}`);
      console.log(`Path: ${replayPath}`);
    } else {
      program.help();
      process.exit(1);
    }
  }

  console.log(`Analyzing Replay: ${path.basename(replayPath)}`);
  console.log(`Output Format:    ${resolution[0]}x${resolution[1]} @ ${options.fps} FPS`);
  let replayInfo: any = {};
  try {
    replayInfo = parseReplay(replayPath);
    console.log(`Player:           ${replayInfo.playerName}`);
    console.log(`Mods:             ${replayInfo.modsString}`);
    console.log(`Score:            ${replayInfo.totalScore.toLocaleString()} | Max Combo: ${replayInfo.maxCombo}x`);
    console.log(`Beatmap MD5:      ${replayInfo.beatmapMd5}`);
  } catch (e: any) {
    console.warn(`[WARN] Could not parse replay header: ${e.message}`);
  }

  const songsDir = path.join(renderer.danserDir, 'Songs');
  if (replayInfo.beatmapMd5) {
    const fetcher = new BeatmapFetcher(songsDir);
    const { success, message } = await fetcher.ensureBeatmap(replayInfo.beatmapMd5, replayPath);
    console.log(`Beatmap Status:   ${message}`);
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
      console.log(`Star Rating:      ${ppResult.stars}* (Aim: ${ppResult.aimStars}* | Speed: ${ppResult.speedStars}*)`);
      console.log(`Performance:      ${ppResult.totalPP} PP (Aim: ${ppResult.aimPP} | Speed: ${ppResult.speedPP} | Acc: ${ppResult.accPP})`);
      console.log(`If 100% SS:       ${ppResult.ssPP} PP (Max Combo: ${ppResult.maxCombo}x)`);
      console.log(`==================================================================`);
    }
  }

  // Skin matching or on-the-fly import
  let selectedSkin: string | undefined;
  if (options.skin) {
    const matched = await skinManager.matchSkin(options.skin);
    if (matched) {
      selectedSkin = matched;
      console.log(`Using Skin:       '${selectedSkin}'`);
    } else {
      selectedSkin = options.skin;
      console.log(`Using Custom Skin:'${selectedSkin}'`);
    }
  }

  const startTime = Date.now();
  const exitCode = await renderer.runRecord(replayPath, selectedSkin, program.args.slice(1));

  // Detect generated video across renderer.outputDir and danser's internal videos directory
  const searchDirs = [renderer.outputDir];
  const danserInternalVideos = path.join(renderer.danserDir, 'videos');
  if (path.resolve(danserInternalVideos) !== path.resolve(renderer.outputDir)) {
    searchDirs.push(danserInternalVideos);
  }

  let finalVideoPath: string | null = null;
  for (const sDir of searchDirs) {
    if (fs.existsSync(sDir)) {
      const files = fs.readdirSync(sDir);
      const videoFiles = files
        .filter((f) => {
          const l = f.toLowerCase();
          return l.endsWith('.mp4') || l.endsWith('.mkv') || l.endsWith('.avi');
        })
        .map((f) => {
          const fullP = path.join(sDir, f);
          const stat = fs.statSync(fullP);
          return { fullP, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      for (const item of videoFiles) {
        if (item.mtime >= startTime - 5000) {
          finalVideoPath = item.fullP;
          break;
        }
      }
      if (finalVideoPath) break;
    }
  }

  // If video was saved to danser's internal folder instead of outputDir, relocate it
  if (finalVideoPath && path.resolve(path.dirname(finalVideoPath)) !== path.resolve(renderer.outputDir)) {
    try {
      fs.mkdirSync(renderer.outputDir, { recursive: true });
      const targetFile = path.join(renderer.outputDir, path.basename(finalVideoPath));
      try {
        fs.renameSync(finalVideoPath, targetFile);
        finalVideoPath = targetFile;
      } catch {
        fs.copyFileSync(finalVideoPath, targetFile);
        try {
          fs.unlinkSync(finalVideoPath);
        } catch {}
        finalVideoPath = targetFile;
      }
    } catch (e: any) {
      console.warn(`[WARN] Could not move video to target outputDir: ${e.message}`);
    }
  }

  if (exitCode === 0 && finalVideoPath) {
    console.log('\n' + '='.repeat(66));
    console.log('Rendering Complete! Video saved to:');
    console.log(`File:        ${finalVideoPath}`);
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
