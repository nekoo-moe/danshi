export interface ProgressUpdate {
    title?: string;
    processName?: string;
    percent?: number;
    detail?: string;
    log?: string;
}
export type ProgressCallback = (update: ProgressUpdate) => void;
export declare class StatusBox {
    verbose: boolean;
    private title;
    private processName;
    private percent;
    private detail;
    private logLine;
    private isRendering;
    private lineCount;
    private lastNonTtyPercent?;
    private lastNonTtyProcess?;
    constructor(verbose?: boolean);
    start(initialProcess?: string, initialLog?: string): void;
    update(update: ProgressUpdate): void;
    private render;
    finish(): void;
}
//# sourceMappingURL=status.d.ts.map