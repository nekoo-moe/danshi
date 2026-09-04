/**
 * Danser Execution & Rendering module in TypeScript (Cross-Platform).
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { DanserConfigOptions } from './types';
import { printStatus, ProgressCallback } from './ui';

export interface RenderResult {
  exitCode: number;
  errorDetails?: string[];
}

export class DanserRenderer {
  public danserDir: string;
  public outputDir: string;
  public settingsFile: string;
  public danserBin: string;

  constructor(danserDir?: string, outputDir?: string) {
    this.danserDir = DanserRenderer.resolveDanserDir(danserDir);
    this.outputDir = outputDir
      ? path.resolve(outputDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''))
      : path.join(this.danserDir, 'videos');
    this.settingsFile = path.join(this.danserDir, 'settings', 'default.json');
    this.danserBin = this.resolveDanserBinary();
  }

  static resolveDanserDir(userPath?: string): string {
    if (userPath) {
      const resolved = path.resolve(userPath.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }

    const home = process.env.HOME || process.env.USERPROFILE || '';
    const candidates: string[] = [
      path.join(home, 'Applications', 'danser'),
      path.join(home, '.danser'),
      path.resolve('./danser'),
      path.resolve('.'),
    ];

    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || '';
      const appData = process.env.APPDATA || '';
      const programFiles = process.env.ProgramFiles || '';
      if (localAppData) {
        candidates.push(path.join(localAppData, 'Programs', 'danser'), path.join(localAppData, 'danser'));
      }
      if (appData) {
        candidates.push(path.join(appData, 'danser'));
      }
      if (programFiles) {
        candidates.push(path.join(programFiles, 'danser'));
      }
    } else if (process.platform === 'darwin') {
      candidates.push(path.join(home, 'Library', 'Application Support', 'danser'));
    }

    for (const c of candidates) {
      if (
        c &&
        fs.existsSync(c) &&
        (fs.existsSync(path.join(c, 'settings')) ||
          fs.existsSync(path.join(c, 'danser')) ||
          fs.existsSync(path.join(c, 'danser.exe')))
      ) {
        return c;
      }
    }

    return path.resolve(userPath || candidates[0]);
  }

  resolveDanserBinary(): string {
    const isWindows = process.platform === 'win32';
    const binNames = isWindows ? ['danser-cli.exe', 'danser.exe'] : ['danser-cli', 'danser'];

    // 1. Search inside danserDir
    for (const name of binNames) {
      const p = path.join(this.danserDir, name);
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return path.join(this.danserDir, binNames[0]);
  }

  configureSettings(options: DanserConfigOptions = {}): void {
    try {
      let cfg: any = {};
      if (fs.existsSync(this.settingsFile)) {
        try {
          const raw = fs.readFileSync(this.settingsFile, 'utf-8');
          cfg = JSON.parse(raw);
        } catch {
          cfg = {};
        }
      }

      const useSkinCursor = options.useSkinCursor ?? true;
      const useSkinHitsounds = options.useSkinHitsounds ?? true;
      const useSkinColors = options.useSkinColors ?? true;
      const skipLeadIn = options.skipLeadIn ?? true;
      const fps = options.fps ?? 60;
      const resolution = options.resolution ?? [1920, 1080];

      // Ensure critical directories exist on disk before Danser starts
      const songsDir = path.join(this.danserDir, 'Songs');
      const skinsDir = path.join(this.danserDir, 'Skins');
      const replaysDir = path.join(this.danserDir, 'Replays');
      fs.mkdirSync(songsDir, { recursive: true });
      fs.mkdirSync(skinsDir, { recursive: true });
      fs.mkdirSync(replaysDir, { recursive: true });
      fs.mkdirSync(this.outputDir, { recursive: true });
      fs.mkdirSync(path.dirname(this.settingsFile), { recursive: true });

      // Always configure General paths explicitly to Danser's internal folders
      cfg.General = cfg.General || {};
      cfg.General.OsuSongsDir = songsDir;
      cfg.General.OsuSkinsDir = skinsDir;
      cfg.General.OsuReplaysDir = replaysDir;
      cfg.General.UnpackOszFiles = true;

      // Graphics & Window size
      cfg.Graphics = cfg.Graphics || {};
      cfg.Graphics.Width = resolution[0];
      cfg.Graphics.Height = resolution[1];

      // Skin
      cfg.Skin = cfg.Skin || {};
      cfg.Skin.UseColorsFromSkin = useSkinColors;
      cfg.Skin.UseBeatmapColors = !useSkinColors;
      cfg.Skin.Cursor = cfg.Skin.Cursor || {};
      cfg.Skin.Cursor.UseSkinCursor = useSkinCursor;
      cfg.Skin.Cursor.CursorRipples = true;

      // Audio / Hitsounds
      cfg.Audio = cfg.Audio || {};
      cfg.Audio.IgnoreBeatmapSamples = useSkinHitsounds;

      // Gameplay - NEVER fail replays mid-game, render all taps & notes completely
      cfg.Gameplay = cfg.Gameplay || {};
      cfg.Gameplay.PPVersion = 'latest';
      cfg.Gameplay.IgnoreFailsInReplays = true;
      cfg.Gameplay.ShowHitLighting = true;
      cfg.Gameplay.ShowWarningArrows = true;

      if (skipLeadIn) {
        cfg.Gameplay.LeadInTime = 0;
        cfg.Gameplay.LeadInHold = 0;
      }
      if (cfg.Gameplay.SeizureWarning) {
        cfg.Gameplay.SeizureWarning.Enabled = false;
      }

      // KeyOverlay (Taps & Keypresses counter)
      cfg.Gameplay.KeyOverlay = cfg.Gameplay.KeyOverlay || {};
      cfg.Gameplay.KeyOverlay.Show = true;
      cfg.Gameplay.KeyOverlay.Scale = 1;
      cfg.Gameplay.KeyOverlay.Opacity = 1;

      // PPCounter
      cfg.Gameplay.PPCounter = cfg.Gameplay.PPCounter || {};
      cfg.Gameplay.PPCounter.Show = true;
      cfg.Gameplay.PPCounter.ShowPPComponents = true;

      // HitCounter, Score, HpBar
      cfg.Gameplay.HitCounter = cfg.Gameplay.HitCounter || {};
      cfg.Gameplay.HitCounter.Show = true;
      cfg.Gameplay.Score = cfg.Gameplay.Score || {};
      cfg.Gameplay.Score.Show = true;
      cfg.Gameplay.HpBar = cfg.Gameplay.HpBar || {};
      cfg.Gameplay.HpBar.Show = true;
      cfg.Gameplay.ComboCounter = cfg.Gameplay.ComboCounter || {};
      cfg.Gameplay.ComboCounter.Show = true;

      // Recording Resolution, FPS & Output Directory
      cfg.Recording = cfg.Recording || {};
      cfg.Recording.FrameWidth = resolution[0];
      cfg.Recording.FrameHeight = resolution[1];
      cfg.Recording.FPS = fps;
      cfg.Recording.Encoder = 'libx264';
      cfg.Recording.OutputDir = this.outputDir;

      fs.writeFileSync(this.settingsFile, JSON.stringify(cfg, null, 4), 'utf-8');
    } catch (e: any) {
      printStatus('config', `could not update danser config: ${e.message.toLowerCase()}`, 'warning');
    }
  }

  runRecord(
    replayPath: string,
    skinName?: string,
    verbose = false,
    onProgress?: ProgressCallback,
    extraArgs: string[] = []
  ): Promise<RenderResult> {
    return new Promise((resolve) => {
      const env = { ...process.env };
      const bundledFfmpeg = path.join(this.danserDir, 'ffmpeg');

      if (fs.existsSync(bundledFfmpeg)) {
        if (process.platform === 'win32') {
          env.PATH = `${bundledFfmpeg};${env.PATH || ''}`;
        } else if (process.platform === 'darwin') {
          env.PATH = `${bundledFfmpeg}:${env.PATH || ''}`;
          env.DYLD_LIBRARY_PATH = `${bundledFfmpeg}:${this.danserDir}:${env.DYLD_LIBRARY_PATH || ''}`;
        } else {
          env.PATH = `${bundledFfmpeg}:${env.PATH || ''}`;
          env.LD_LIBRARY_PATH = `${bundledFfmpeg}:${this.danserDir}:${env.LD_LIBRARY_PATH || ''}`;
        }
      }

      const args = ['-record', '-preciseprogress', '-noupdatecheck', '-skip', '-replay', path.resolve(replayPath)];
      if (skinName) {
        args.push('-skin', skinName);
      }
      if (extraArgs.length > 0) {
        args.push(...extraArgs);
      }

      if (verbose) {
        if (onProgress) {
          onProgress({ processName: 'rendering', percent: 0, log: `launching ${path.basename(this.danserBin).toLowerCase()}...` });
        } else {
          printStatus('exec', `launching danser: ${path.basename(this.danserBin).toLowerCase()} ${args.join(' ').toLowerCase()}`);
        }

        const child = spawn(this.danserBin, args, {
          cwd: this.danserDir,
          env,
          stdio: 'inherit',
        });

        child.on('close', (code) => {
          resolve({ exitCode: code ?? 0 });
        });

        child.on('error', (err) => {
          printStatus('render', `failed to start danser binary: ${err.message.toLowerCase()}`, 'error');
          resolve({ exitCode: 1, errorDetails: [err.message] });
        });
        return;
      }

      // Non-verbose: Stream capture with StatusBox progress reporting
      if (onProgress) {
        onProgress({ processName: 'rendering', percent: 0, detail: 'starting encoder', log: 'launching danser-cli...' });
      }

      const child = spawn(this.danserBin, args, {
        cwd: this.danserDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const recentLogs: string[] = [];

      const handleChunk = (chunk: Buffer | string) => {
        const str = chunk.toString();
        const lines = str.split(/[\r\n]+/);

        for (const rawLine of lines) {
          const trimmed = rawLine.trim();
          if (!trimmed) continue;

          recentLogs.push(trimmed);
          if (recentLogs.length > 12) recentLogs.shift();

          const progressMatch = trimmed.match(/progress:\s*([\d.]+)%/i);
          const etaMatch = trimmed.match(/\[?eta:\s*([^\s\]]+)\]?/i);
          const fpsMatch = trimmed.match(/\[?fps:\s*([\d.]+)\]?/i);

          if (progressMatch) {
            const percent = parseFloat(progressMatch[1]);
            const eta = etaMatch ? etaMatch[1] : undefined;
            const fps = fpsMatch ? fpsMatch[1] : undefined;

            const detailParts: string[] = [];
            if (fps) detailParts.push(`fps: ${fps}`);
            if (eta) detailParts.push(`eta: ${eta}`);
            const detail = detailParts.length > 0 ? detailParts.join(' · ') : undefined;

            onProgress?.({
              processName: 'rendering',
              percent,
              detail,
              log: `encoding video frames (${percent}%)...`,
            });
          } else {
            // Strip leading date/time stamps
            const clean = trimmed.replace(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+/, '').trim();
            if (clean && !clean.toLowerCase().includes('progress:')) {
              onProgress?.({
                processName: 'rendering',
                log: clean.toLowerCase(),
              });
            }
          }
        }
      };

      child.stdout?.on('data', handleChunk);
      child.stderr?.on('data', handleChunk);

      child.on('close', (code) => {
        if (code === 0) {
          onProgress?.({ processName: 'rendering', percent: 100, detail: 'completed', log: 'encoding finished' });
          resolve({ exitCode: 0 });
        } else {
          resolve({ exitCode: code ?? 1, errorDetails: recentLogs });
        }
      });

      child.on('error', (err) => {
        resolve({ exitCode: 1, errorDetails: [err.message] });
      });
    });
  }
}
