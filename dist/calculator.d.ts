/**
 * Modern Performance Points (PP) & Star Rating Calculator (2026 Update).
 * Powered by rosu-pp-js (Rust WebAssembly implementation matching the latest official osu! reworks).
 */
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
export declare class PPCalculator {
    /**
     * Calculates modern 2026 PP and Star Rating for a replay against its .osu beatmap.
     */
    static calculate(osuFilePathOrContent: string | Buffer, replay: ReplayMetadata): PPResult | null;
    /**
     * Finds the .osu difficulty file in the Songs directory matching a beatmap MD5 or difficulty name.
     */
    static findOsuFileInSongs(songsDir: string, beatmapMd5?: string, diffHint?: string): string | null;
}
//# sourceMappingURL=calculator.d.ts.map