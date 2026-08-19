/**
 * Danser Execution & Rendering module in TypeScript (Cross-Platform).
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { DanserConfigOptions } from './types';

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
      fs.mkdirSync(path.dirname(this.settingsFile), { recursive: true });

      // Always configure General paths explicitly to Danser's internal folders
      cfg.General = cfg.General || {};
      cfg.General.OsuSongsDir = songsDir;
      cfg.General.OsuSkinsDir = skinsDir;
      cfg.General.OsuReplaysDir = replaysDir;
      cfg.General.UnpackOszFiles = true;

      // Skin
      cfg.Skin = cfg.Skin || {};
      cfg.Skin.UseColorsFromSkin = useSkinColors;
      cfg.Skin.UseBeatmapColors = !useSkinColors;
      cfg.Skin.Cursor = cfg.Skin.Cursor || {};
      cfg.Skin.Cursor.UseSkinCursor = useSkinCursor;

      // Audio / Hitsounds
      cfg.Audio = cfg.Audio || {};
      cfg.Audio.IgnoreBeatmapSamples = useSkinHitsounds;

      // Gameplay
      cfg.Gameplay = cfg.Gameplay || {};
      cfg.Gameplay.PPVersion = 'latest';
      if (skipLeadIn) {
        cfg.Gameplay.LeadInTime = 0;
        cfg.Gameplay.LeadInHold = 0;
      }
      if (cfg.Gameplay.SeizureWarning) {
        cfg.Gameplay.SeizureWarning.Enabled = false;
      }

      // PPCounter
      cfg.Gameplay.PPCounter = cfg.Gameplay.PPCounter || {};
      cfg.Gameplay.PPCounter.Show = true;
      cfg.Gameplay.PPCounter.ShowPPComponents = true;

      // Recording
      if (cfg.Recording) {
        cfg.Recording.FrameWidth = resolution[0];
        cfg.Recording.FrameHeight = resolution[1];
        cfg.Recording.FPS = fps;
        cfg.Recording.Encoder = 'libx264';
      }

      fs.writeFileSync(this.settingsFile, JSON.stringify(cfg, null, 4), 'utf-8');
    } catch (e: any) {
      console.log(`[WARN] Could not update Danser config: ${e.message}`);
    }
  }

  runRecord(replayPath: string, skinName?: string, extraArgs: string[] = []): Promise<number> {
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

      const args = ['-record', '-skip', '-replay', path.resolve(replayPath)];
      if (skinName) {
        args.push('-skin', skinName);
      }
      if (extraArgs.length > 0) {
        args.push(...extraArgs);
      }

      console.log(`\n[EXEC] Launching Danser: ${this.danserBin} ${args.join(' ')}`);

      const child = spawn(this.danserBin, args, {
        cwd: this.danserDir,
        env,
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        resolve(code ?? 0);
      });

      child.on('error', (err) => {
        console.error(`[ERROR] Failed to start Danser binary: ${err.message}`);
        resolve(1);
      });
    });
  }
}
