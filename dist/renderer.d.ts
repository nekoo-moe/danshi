/**
 * Danser Execution & Rendering module in TypeScript (Cross-Platform).
 */
import { DanserConfigOptions } from './types';
export declare class DanserRenderer {
    danserDir: string;
    outputDir: string;
    settingsFile: string;
    danserBin: string;
    constructor(danserDir?: string, outputDir?: string);
    static resolveDanserDir(userPath?: string): string;
    resolveDanserBinary(): string;
    configureSettings(options?: DanserConfigOptions): void;
    runRecord(replayPath: string, skinName?: string, extraArgs?: string[]): Promise<number>;
}
//# sourceMappingURL=renderer.d.ts.map