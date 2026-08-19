/**
 * Beatmap Auto-Fetcher in TypeScript.
 * Resolves Beatmap MD5 checksums and fallback text queries across multiple mirror APIs.
 */
import { BeatmapInfo, FilenameMetadata } from './types';
export declare class BeatmapFetcher {
    private songsDir;
    constructor(songsDir: string);
    fetchByMd5Catboy(md5: string): Promise<BeatmapInfo | null>;
    fetchByMd5Sayobot(md5: string): Promise<BeatmapInfo | null>;
    parseReplayFilename(filename: string): FilenameMetadata;
    searchMirrorWithMetadata(meta: FilenameMetadata): Promise<BeatmapInfo | null>;
    resolveBeatmap(md5: string, filenameHint?: string): Promise<BeatmapInfo | null>;
    ensureBeatmap(md5: string, filenameHint?: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=fetcher.d.ts.map