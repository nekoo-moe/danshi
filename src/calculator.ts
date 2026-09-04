/**
 * Modern Performance Points (PP) & Star Rating Calculator (2026 Update).
 * Powered by rosu-pp-js (Rust WebAssembly implementation matching the latest official osu! reworks).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { Beatmap, Performance } from 'rosu-pp-js';
import { ReplayMetadata } from './types';
import { printStatus } from './ui';

export interface PPResult {
  stars: number;
  aimStars: number;
  speedStars: number;
  totalPP: number;
  aimPP: number;
  speedPP: number;
  accPP: number;
  flashlightPP: number;
  maxCombo: number;
  ssPP: number;
}

export class PPCalculator {
  /**
   * Calculates modern 2026 PP and Star Rating for a replay against its .osu beatmap.
   */
  static calculate(osuFilePathOrContent: string | Buffer, replay: ReplayMetadata): PPResult | null {
    try {
      let content: Buffer;
      if (typeof osuFilePathOrContent === 'string') {
        if (!fs.existsSync(osuFilePathOrContent)) return null;
        content = fs.readFileSync(osuFilePathOrContent);
      } else {
        content = osuFilePathOrContent;
      }

      const map = new Beatmap(content);

      // 1. Calculate actual play performance
      const playPerf = new Performance({
        mods: replay.modsInt,
        n300: replay.count300,
        n100: replay.count100,
        n50: replay.count50,
        misses: replay.countMiss,
        combo: replay.maxCombo,
      });

      const playResult = playPerf.calculate(map);

      // 2. Calculate 100% SS maximum performance
      const ssPerf = new Performance({
        mods: replay.modsInt,
      });
      const ssResult = ssPerf.calculate(map);

      return {
        stars: Number(playResult.difficulty.stars.toFixed(2)),
        aimStars: Number((playResult.difficulty.aim ?? 0).toFixed(2)),
        speedStars: Number((playResult.difficulty.speed ?? 0).toFixed(2)),
        totalPP: Number(playResult.pp.toFixed(2)),
        aimPP: Number((playResult.ppAim ?? 0).toFixed(2)),
        speedPP: Number((playResult.ppSpeed ?? 0).toFixed(2)),
        accPP: Number((playResult.ppAccuracy ?? 0).toFixed(2)),
        flashlightPP: Number((playResult.ppFlashlight ?? 0).toFixed(2)),
        maxCombo: playResult.difficulty.maxCombo ?? 0,
        ssPP: Number(ssResult.pp.toFixed(2)),
      };
    } catch (e: any) {
      printStatus('pp', `could not calculate modern pp: ${e.message.toLowerCase()}`, 'warning');
      return null;
    }
  }

  /**
   * Finds the .osu difficulty file in the Songs directory matching a beatmap MD5 or difficulty name.
   */
  static findOsuFileInSongs(songsDir: string, beatmapMd5?: string, diffHint?: string): string | null {
    if (!fs.existsSync(songsDir)) return null;

    // 1. Unpack any .osz archive that hasn't been extracted yet
    try {
      const entries = fs.readdirSync(songsDir);
      for (const entry of entries) {
        if (entry.toLowerCase().endsWith('.osz')) {
          const folderName = entry.replace(/\.osz$/i, '');
          const folderPath = path.join(songsDir, folderName);
          if (!fs.existsSync(folderPath)) {
            try {
              const zip = new AdmZip(path.join(songsDir, entry));
              zip.extractAllTo(folderPath, true);
            } catch {
              // Ignore unpack error here
            }
          }
        }
      }
    } catch {
      // Ignore scan error
    }

    const cleanMd5 = (beatmapMd5 || '').toLowerCase().trim();
    let diffFallback: string | null = null;

    for (const entry of fs.readdirSync(songsDir)) {
      const fullPath = path.join(songsDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        for (const file of fs.readdirSync(fullPath)) {
          if (file.toLowerCase().endsWith('.osu')) {
            const osuP = path.join(fullPath, file);
            try {
              if (cleanMd5) {
                const fileBuf = fs.readFileSync(osuP);
                const hash = crypto.createHash('md5').update(fileBuf).digest('hex').toLowerCase();
                if (hash === cleanMd5) {
                  return osuP;
                }
              }
            } catch {}

            if (diffHint && file.toLowerCase().includes(`[${diffHint.toLowerCase()}]`)) {
              diffFallback = osuP;
            }
          }
        }
      }
    }

    return diffFallback;
  }

  /**
   * Extracts metadata (beatmap ID, set ID, title, artist, difficulty name) from a .osu file.
   */
  static extractOsuMeta(osuFilePath: string): {
    beatmapId?: number;
    beatmapSetId?: number;
    title?: string;
    artist?: string;
    diff?: string;
  } {
    try {
      if (!fs.existsSync(osuFilePath)) return {};
      const content = fs.readFileSync(osuFilePath, 'utf-8');
      const bidMatch = content.match(/^BeatmapID:\s*(\d+)/m);
      const sidMatch = content.match(/^BeatmapSetID:\s*(\d+)/m);
      const titleMatch = content.match(/^Title:\s*(.+)/m);
      const artistMatch = content.match(/^Artist:\s*(.+)/m);
      const versionMatch = content.match(/^Version:\s*(.+)/m);

      return {
        beatmapId: bidMatch ? parseInt(bidMatch[1], 10) : undefined,
        beatmapSetId: sidMatch ? parseInt(sidMatch[1], 10) : undefined,
        title: titleMatch ? titleMatch[1].trim() : undefined,
        artist: artistMatch ? artistMatch[1].trim() : undefined,
        diff: versionMatch ? versionMatch[1].trim() : undefined,
      };
    } catch {
      return {};
    }
  }
}
