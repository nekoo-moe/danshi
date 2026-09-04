/**
 * Auto-Installer & Bootstrapper for Danser-go.
 * Automatically detects OS, downloads the latest Danser-go release, unpacks it,
 * and sets up executable permissions without requiring manual intervention.
 */
import { ProgressCallback } from './ui';
export interface DanserReleaseAsset {
    name: string;
    downloadUrl: string;
    size: number;
}
export declare class DanserInstaller {
    static getPlatformKeyword(): 'win' | 'linux' | 'mac';
    static getDefaultInstallDir(): string;
    static isDanserInstalled(dir: string): boolean;
    static resolveDownloadUrl(): Promise<DanserReleaseAsset>;
    static ensureInstalled(targetDir?: string, onProgress?: ProgressCallback): Promise<string>;
}
//# sourceMappingURL=installer.d.ts.map