/**
 * Type definitions for Danser AutoFetch.
 */
export interface ReplayMetadata {
    mode: number;
    gameVersion: number;
    beatmapMd5: string;
    playerName: string;
    replayMd5: string;
    count300: number;
    count100: number;
    count50: number;
    countGeki: number;
    countKatu: number;
    countMiss: number;
    totalScore: number;
    maxCombo: number;
    fullCombo: boolean;
    modsInt: number;
    modsString: string;
}
export interface BeatmapInfo {
    beatmapSetId: number;
    title: string;
    artist: string;
    version?: string;
    creator?: string;
    downloadUrl: string;
    source: string;
}
export interface FilenameMetadata {
    artist?: string;
    title?: string;
    creator?: string;
    diff?: string;
}
export interface DanserConfigOptions {
    useSkinCursor?: boolean;
    useSkinHitsounds?: boolean;
    useSkinColors?: boolean;
    skipLeadIn?: boolean;
    fps?: number;
    resolution?: [number, number];
}
export interface SystemPaths {
    danserDir: string;
    outputDir: string;
    osuExportsDir: string;
}
//# sourceMappingURL=types.d.ts.map