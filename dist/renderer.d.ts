/**
 * Danser Execution & Rendering module in TypeScript (Cross-Platform).
 */
import { DanserConfigOptions } from './types';
import { ProgressCallback } from './ui';
export interface RenderResult {
    exitCode: number;
    errorDetails?: string[];
}
export declare class DanserRenderer {
    danserDir: string;
    outputDir: string;
    settingsFile: string;
    danserBin: string;
    constructor(danserDir?: string, outputDir?: string);
    static resolveDanserDir(userPath?: string): string;
    resolveDanserBinary(): string;
    configureSettings(options?: DanserConfigOptions): void;
    runRecord(replayPath: string, skinName?: string, verbose?: boolean, onProgress?: ProgressCallback, extraArgs?: string[]): Promise<RenderResult>;
}
//# sourceMappingURL=renderer.d.ts.map