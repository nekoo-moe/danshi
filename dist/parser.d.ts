/**
 * osu! replay (.osr) binary parser in TypeScript.
 */
import { ReplayMetadata } from './types';
export declare const MODS_MAP: Record<number, string>;
export declare function parseMods(modsInt: number): string;
export declare function parseReplay(filePath: string): ReplayMetadata;
//# sourceMappingURL=parser.d.ts.map