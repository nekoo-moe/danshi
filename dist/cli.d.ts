#!/usr/bin/env node
/**
 * CLI Entry point for Danser AutoFetch in TypeScript.
 */
import { SystemPaths } from './types';
export declare function parseResolution(input?: string): [number, number];
export declare function resolveReplayPath(arg?: string, osuExportsDir?: string, danserDir?: string): string | null;
export declare function getDefaultPaths(): SystemPaths;
export declare function run(): Promise<void>;
//# sourceMappingURL=cli.d.ts.map