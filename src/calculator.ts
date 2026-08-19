/**
 * Modern Performance Points (PP) & Star Rating Calculator (2026 Update).
 * Powered by rosu-pp-js (Rust WebAssembly implementation matching the latest official osu! reworks).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Beatmap, Performance } from 'rosu-pp-js';
import { ReplayMetadata } from './types';

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
      console.warn(`⚠️ Warning: Could not calculate modern PP: ${e.message}`);
      return null;
    }
  }

  /**
   * Finds the .osu difficulty file in the Songs directory matching a beatmap MD5 or difficulty name.
   */
  static findOsuFileInSongs(songsDir: string, beatmapMd5?: string, diffHint?: string): string | null {
    if (!fs.existsSync(songsDir)) return null;

    for (const entry of fs.readdirSync(songsDir)) {
      const fullPath = path.join(songsDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        for (const file of fs.readdirSync(fullPath)) {
          if (file.endsWith('.osu')) {
            const osuP = path.join(fullPath, file);
            if (diffHint && file.toLowerCase().includes(`[${diffHint.toLowerCase()}]`)) {
              return osuP;
            }
          }
        }
      }
    }
    return null;
  }
}
