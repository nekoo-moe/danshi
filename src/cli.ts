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
import {
  printBanner,
  printStatus,
  printReplayCard,
  printCompletionCard,
  printErrorCard,
  printSkinsList,
  StatusBox,
} from './ui';

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

function displayBanner(): void {
  printBanner(packageJson.version);
}

export async function run(): Promise<void> {
  const defaults = getDefaultPaths();

  const program = new Command();
  program
    .name('danser-autofetch')
    .description('auto-fetch beatmaps and render osu! replay files (.osr) into mp4 videos using danser across windows, linux, and macos.')
    .version(packageJson.version, '-v, --version', 'output program version')
    .argument('[replay]', 'path to the osu! replay file (.osr)')
    .option('-s, --skin <skin>', 'skin name, local file path (.osk/.zip), folder path, or direct download url')
    .option('-r, --resolution <resolution>', 'output video resolution: 480p, 720p, 1080p, 1440p (2k), 4k, or custom wxh (e.g. 1920x1080)', '1080p')
    .option('--fps <fps>', 'output video framerate (e.g. 30, 60, 120)', (val) => parseInt(val, 10), 60)
    .option('--import-skin <pathOrUrl>', 'import a new skin from a local path (.osk/.zip/folder) or download url')
    .option('-d, --danser-dir <path>', 'path to danser directory', defaults.danserDir)
    .option('-o, --output-dir <path>', 'directory to store output mp4 videos', defaults.outputDir)
    .option('--exports-dir <path>', 'osu! lazer exports directory', defaults.osuExportsDir)
    .option('--list-skins', 'list all available skins in danser and exit')
    .option('--sync-skins', 'manually sync skins from osu! exports and downloads folders')
    .option('--verbose', 'show detailed log output instead of compact status')
    .allowUnknownOption(true);

  program.parse(process.argv);
  const options = program.opts();
  const replayArg = program.args[0];

  displayBanner();

  const targetDanserDir = options.danserDir || defaults.danserDir;

  // 1. explicit skin import
  if (options.importSkin) {
    const skinManager = new SkinManager(path.join(targetDanserDir, 'Skins'), options.exportsDir);
    const importedName = await skinManager.importSkin(options.importSkin);
    if (importedName) {
      printStatus('skin', `added new skin: '${importedName.toLowerCase()}'`, 'success');
      printStatus('usage', `danser-record <replay.osr> -s "${importedName.toLowerCase()}"`);
    }
    return;
  }

  // 2. manual skin sync
  if (options.syncSkins) {
    const skinManager = new SkinManager(path.join(targetDanserDir, 'Skins'), options.exportsDir);
    const imported = await skinManager.syncFromSources();
    printStatus('skin', `synchronized ${imported} skin(s) from system folders into danser.`, 'success');
    return;
  }

  // 3. list skins
  if (options.listSkins) {
    const skinManager = new SkinManager(path.join(targetDanserDir, 'Skins'), options.exportsDir);
    const skins = skinManager.listSkins();
    printSkinsList(skins);
    return;
  }

  // 4. resolve replay path
  let replayPath: string | null = null;
  if (replayArg) {
    replayPath = resolveReplayPath(replayArg, options.exportsDir, targetDanserDir);
    if (!replayPath) {
      printErrorCard('replay not found', `replay file not found: '${replayArg.toLowerCase()}'`, [
        'searched in: current directory, downloads, documents, desktop, and osu! exports folder.',
      ]);
      process.exit(1);
    }
  } else {
    // if no replay argument was provided, try picking the newest replay automatically
    replayPath = resolveReplayPath(undefined, options.exportsDir, targetDanserDir);
    if (!replayPath) {
      program.help();
      process.exit(1);
    }
  }

  // 5. parse replay header and compute preview PP if beatmap is already present
  let replayInfo: any = {};
  try {
    replayInfo = parseReplay(replayPath);
  } catch {
    replayInfo = {};
  }

  const initialSongsDir = path.join(targetDanserDir, 'Songs');
  const meta = new BeatmapFetcher(initialSongsDir).parseReplayFilename(replayPath);
  let ppResult: any = null;
  if (replayInfo.beatmapMd5) {
    const osuFile = PPCalculator.findOsuFileInSongs(initialSongsDir, replayInfo.beatmapMd5, meta.diff);
    if (osuFile) {
      const osuMeta = PPCalculator.extractOsuMeta(osuFile);
      if (!meta.beatmapId && osuMeta.beatmapId) {
        meta.beatmapId = osuMeta.beatmapId;
      }
      if (!meta.title && osuMeta.title) {
        meta.title = osuMeta.title;
      }
      if (!meta.artist && osuMeta.artist) {
        meta.artist = osuMeta.artist;
      }
      if (!meta.diff && osuMeta.diff) {
        meta.diff = osuMeta.diff;
      }
      ppResult = PPCalculator.calculate(osuFile, replayInfo);
    }
  }

  // render unified replay card immediately below banner with zero empty lines
  printReplayCard(replayPath, replayInfo, meta, ppResult);

  // 6. start dynamic status box
  const statusBox = new StatusBox(Boolean(options.verbose));
  statusBox.start('setup', 'initializing danser environment...');

  let danserDir = options.danserDir;
  try {
    danserDir = await DanserInstaller.ensureInstalled(options.danserDir, (p) => statusBox.update(p));
  } catch (err: any) {
    statusBox.finish();
    printErrorCard('initialization failed', `failed to initialize danser: ${err.message.toLowerCase()}`);
    process.exit(1);
  }

  const renderer = new DanserRenderer(danserDir, options.outputDir);
  const resolution = parseResolution(options.resolution);

  renderer.configureSettings({
    useSkinCursor: true,
    useSkinHitsounds: true,
    useSkinColors: true,
    skipLeadIn: true,
    fps: options.fps,
    resolution,
  });

  const songsDir = path.join(renderer.danserDir, 'Songs');
  if (replayInfo.beatmapMd5) {
    const fetcher = new BeatmapFetcher(songsDir);
    const { success, message } = await fetcher.ensureBeatmap(replayInfo.beatmapMd5, replayPath, (p) =>
      statusBox.update(p)
    );
    if (!success) {
      statusBox.update({ processName: 'fetch', log: message.toLowerCase() });
    }
  }

  const skinManager = new SkinManager(path.join(renderer.danserDir, 'Skins'), options.exportsDir);
  let selectedSkin: string | undefined;
  if (options.skin) {
    const matched = await skinManager.matchSkin(options.skin);
    selectedSkin = matched || options.skin;
  }

  statusBox.update({
    processName: 'rendering',
    percent: 0,
    detail: `${resolution[0]}x${resolution[1]} @ ${options.fps} fps`,
    log: 'launching danser-cli...',
  });

  const startTime = Date.now();
  const renderResult = await renderer.runRecord(
    replayPath,
    selectedSkin,
    options.verbose,
    (p) => statusBox.update(p),
    program.args.slice(1)
  );
  const exitCode = renderResult.exitCode;

  statusBox.finish();

  // detect generated video across renderer.outputDir and danser's internal videos directory
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

  // if video was saved to danser's internal folder instead of outputDir, relocate it
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
    } catch {
      // Ignore file relocation error
    }
  }

  if (exitCode === 0 && finalVideoPath) {
    printCompletionCard(finalVideoPath, resolution, options.fps, renderer.outputDir);
  } else {
    const details =
      renderResult.errorDetails && renderResult.errorDetails.length > 0
        ? renderResult.errorDetails
        : ["if the beatmap was not found, please ensure the beatmap (.osz) is in danser's songs folder."];
    printErrorCard('render incomplete', 'rendering ended without producing a video.', details);
    process.exit(exitCode === 0 ? 1 : exitCode);
  }
}

if (require.main === module) {
  run().catch((err) => {
    printErrorCard('runtime error', (err.message || String(err)).toLowerCase());
    process.exit(1);
  });
}
