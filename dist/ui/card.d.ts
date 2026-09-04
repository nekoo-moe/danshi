import { ReplayMetadata, FilenameMetadata } from '../types';
import { PPResult } from '../calculator';
export type ColorFn = (s: string) => string;
export declare function borderLine(width: number, left: string, right: string, colorFn?: ColorFn): string;
export declare function boxedLine(content: string, width: number, leftColor?: ColorFn, rightColor?: ColorFn): string;
export declare function innerRule(label: string, width: number): string;
export declare function renderMeta(label: string, value?: string | number | null, labelWidth?: number): string;
export declare function printBanner(version: string, subtitle?: string): void;
export declare function printStatus(tag: string, message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
export declare function renderProgress(tag: string, downloaded: number, total: number, unit?: string): void;
export declare function finishProgress(): void;
export declare function printReplayCard(replayPath: string, replay: Partial<ReplayMetadata>, meta?: FilenameMetadata, ppResult?: PPResult | null): void;
export declare function printCompletionCard(videoPath: string, resolution: [number, number], fps: number, outputDir: string): void;
export declare function printErrorCard(title: string, message: string, details?: string[]): void;
export declare function printSkinsList(skins: string[]): void;
//# sourceMappingURL=card.d.ts.map