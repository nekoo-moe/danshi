/**
 * Skin Manager in TypeScript.
 * Handles on-demand skin importing from local .osk / .zip / folder paths, URLs, and fuzzy name matching.
 */
export declare class SkinManager {
    private skinsDir;
    private osuExportsDir?;
    constructor(skinsDir: string, osuExportsDir?: string);
    importSkin(sourcePathOrUrl: string): Promise<string | null>;
    syncFromSources(): Promise<number>;
    listSkins(): string[];
    matchSkin(query: string): Promise<string | null>;
}
//# sourceMappingURL=skins.d.ts.map