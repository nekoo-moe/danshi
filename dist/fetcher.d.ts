/**
 * Beatmap Auto-Fetcher in TypeScript.
 * Resolves Beatmap MD5 checksums and fallback text queries across multiple mirror APIs:
 * Catboy/Mino, Sayobot, osu.direct, Nerinyan.
 */
import { BeatmapInfo, FilenameMetadata } from './types';
import { ProgressCallback } from './ui';
export declare class BeatmapFetcher {
    private songsDir;
    constructor(songsDir: string);
    static getDownloadCandidates(sid: number | string): {
        name: string;
        url: string;
    }[];
    fetchByMd5Catboy(md5: string): Promise<BeatmapInfo | null>;
    fetchByMd5Sayobot(md5: string): Promise<BeatmapInfo | null>;
    fetchByMd5OsuDirect(md5: string): Promise<BeatmapInfo | null>;
    fetchByBeatmapId(bid: number): Promise<BeatmapInfo | null>;
    fetchByMd5Nerinyan(md5: string): Promise<BeatmapInfo | null>;
    parseReplayFilename(filename: string): FilenameMetadata;
    searchMirrorWithMetadata(meta: FilenameMetadata): Promise<BeatmapInfo | null>;
    resolveBeatmap(md5: string, filenameHint?: string, onProgress?: ProgressCallback): Promise<BeatmapInfo | null>;
    downloadFromMirrors(sid: number | string, targetOsz: string, onProgress?: ProgressCallback): Promise<boolean>;
    ensureBeatmap(md5: string, filenameHint?: string, onProgress?: ProgressCallback): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=fetcher.d.ts.map