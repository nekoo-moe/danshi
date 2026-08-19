"use strict";
/**
 * Skin Manager in TypeScript.
 * Handles on-demand skin importing from local .osk / .zip / folder paths, URLs, and fuzzy name matching.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkinManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
class SkinManager {
    skinsDir;
    osuExportsDir;
    constructor(skinsDir, osuExportsDir) {
        this.skinsDir = path.resolve(skinsDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
        if (!fs.existsSync(this.skinsDir)) {
            fs.mkdirSync(this.skinsDir, { recursive: true });
        }
        if (osuExportsDir) {
            this.osuExportsDir = path.resolve(osuExportsDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
        }
    }
    async importSkin(sourcePathOrUrl) {
        let rawPath = sourcePathOrUrl.trim().replace(/^["']|["']$/g, '');
        // 1. Direct URL download
        if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
            console.log(`📥 Downloading skin from URL: ${rawPath}...`);
            const tempOsk = path.join(this.skinsDir, '_temp_import.osk');
            try {
                const resp = await fetch(rawPath, { headers: { 'User-Agent': 'danser-autofetch' } });
                if (!resp.ok)
                    throw new Error(`HTTP Error ${resp.status}`);
                const arrayBuffer = await resp.arrayBuffer();
                fs.writeFileSync(tempOsk, Buffer.from(arrayBuffer));
                rawPath = tempOsk;
            }
            catch (e) {
                console.log(`❌ Failed to download skin from URL: ${e.message}`);
                return null;
            }
        }
        const cleanPath = path.resolve(rawPath.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
        if (!fs.existsSync(cleanPath)) {
            return null;
        }
        const stat = fs.statSync(cleanPath);
        // 2. Local folder import
        if (stat.isDirectory()) {
            const skinName = path.basename(cleanPath);
            const dst = path.join(this.skinsDir, skinName);
            if (path.resolve(cleanPath) !== path.resolve(dst)) {
                if (fs.existsSync(dst)) {
                    fs.rmSync(dst, { recursive: true, force: true });
                }
                fs.cpSync(cleanPath, dst, { recursive: true });
            }
            console.log(`✅ Successfully imported skin folder: '${skinName}'`);
            return skinName;
        }
        // 3. Compressed skin archive (.osk / .zip)
        const lower = cleanPath.toLowerCase();
        if (lower.endsWith('.osk') || lower.endsWith('.zip')) {
            let rawName = path.basename(cleanPath).replace(/\.[^/.]+$/, '');
            if (rawName === '_temp_import') {
                rawName = 'Imported_Skin';
            }
            // Remove duplicate markers like (1), (2)
            if (rawName.includes(' (') && rawName.endsWith(')')) {
                rawName = rawName.replace(/\s*\(\d+\)$/, '').trim();
            }
            const dst = path.join(this.skinsDir, rawName);
            if (!fs.existsSync(dst)) {
                fs.mkdirSync(dst, { recursive: true });
            }
            try {
                const zip = new adm_zip_1.default(cleanPath);
                zip.extractAllTo(dst, true);
                console.log(`✅ Successfully unpacked & installed skin: '${rawName}'`);
                if (cleanPath.endsWith('_temp_import.osk') && fs.existsSync(cleanPath)) {
                    fs.unlinkSync(cleanPath);
                }
                return rawName;
            }
            catch (e) {
                console.log(`❌ Failed to unpack skin archive: ${e.message}`);
                return null;
            }
        }
        return null;
    }
    async syncFromSources() {
        const scanDirs = [];
        if (this.osuExportsDir && fs.existsSync(this.osuExportsDir)) {
            scanDirs.push(this.osuExportsDir);
        }
        const downloadsDir = path.resolve((process.env.HOME || process.env.USERPROFILE || ''), 'Downloads');
        if (fs.existsSync(downloadsDir)) {
            scanDirs.push(downloadsDir);
        }
        let count = 0;
        for (const sDir of scanDirs) {
            const items = fs.readdirSync(sDir);
            for (const item of items) {
                const src = path.join(sDir, item);
                const lower = item.toLowerCase();
                if ((lower.endsWith('.osk') || lower.endsWith('.zip')) && !item.startsWith('.')) {
                    let skinName = item.replace(/\.[^/.]+$/, '');
                    if (skinName.includes(' (') && skinName.endsWith(')')) {
                        skinName = skinName.replace(/\s*\(\d+\)$/, '').trim();
                    }
                    const dst = path.join(this.skinsDir, skinName);
                    if (!fs.existsSync(dst)) {
                        const imported = await this.importSkin(src);
                        if (imported)
                            count += 1;
                    }
                }
                else if (fs.statSync(src).isDirectory() && sDir === this.osuExportsDir) {
                    const dst = path.join(this.skinsDir, item);
                    if (!fs.existsSync(dst)) {
                        fs.cpSync(src, dst, { recursive: true });
                        count += 1;
                    }
                }
            }
        }
        return count;
    }
    listSkins() {
        if (!fs.existsSync(this.skinsDir)) {
            return [];
        }
        return fs.readdirSync(this.skinsDir).filter((d) => {
            const p = path.join(this.skinsDir, d);
            return fs.statSync(p).isDirectory();
        });
    }
    async matchSkin(query) {
        const cleanQuery = query.trim().replace(/^["']|["']$/g, '');
        // If query is an existing local file or directory or URL, import on-the-fly
        const resolvedPath = path.resolve(cleanQuery.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
        if (cleanQuery.startsWith('http://') || cleanQuery.startsWith('https://') || fs.existsSync(resolvedPath)) {
            const imported = await this.importSkin(cleanQuery);
            if (imported)
                return imported;
        }
        const available = this.listSkins();
        if (available.length === 0)
            return null;
        // 1. Exact match
        for (const s of available) {
            if (s.toLowerCase() === cleanQuery.toLowerCase()) {
                return s;
            }
        }
        // 2. Starts with query
        for (const s of available) {
            if (s.toLowerCase().startsWith(cleanQuery.toLowerCase())) {
                return s;
            }
        }
        // 3. Substring match
        for (const s of available) {
            if (s.toLowerCase().includes(cleanQuery.toLowerCase())) {
                return s;
            }
        }
        return null;
    }
}
exports.SkinManager = SkinManager;
//# sourceMappingURL=skins.js.map