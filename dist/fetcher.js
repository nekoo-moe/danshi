"use strict";
/**
 * Beatmap Auto-Fetcher in TypeScript.
 * Resolves Beatmap MD5 checksums and fallback text queries across multiple mirror APIs.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeatmapFetcher = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const USER_AGENT = 'danser-autofetch/1.0.0 (https://github.com/heiznerd/danser-autofetch)';
class BeatmapFetcher {
    songsDir;
    constructor(songsDir) {
        this.songsDir = path.resolve(songsDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
        if (!fs.existsSync(this.songsDir)) {
            fs.mkdirSync(this.songsDir, { recursive: true });
        }
    }
    async fetchByMd5Catboy(md5) {
        const url = `https://catboy.best/api/v2/md5/${md5}`;
        try {
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            const sid = data.beatmapset_id;
            if (sid) {
                return {
                    beatmapSetId: sid,
                    title: data.title || 'Unknown',
                    artist: data.artist || 'Unknown',
                    downloadUrl: `https://catboy.best/d/${sid}`,
                    source: 'Catboy/Mino (MD5)',
                };
            }
        }
        catch {
            // Ignore network errors
        }
        return null;
    }
    async fetchByMd5Sayobot(md5) {
        const url = `https://api.sayobot.cn/v2/beatmapinfo?K=${md5}&T=1`;
        try {
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            if (data.status === 0 && data.data && data.data.sid) {
                return {
                    beatmapSetId: data.data.sid,
                    title: data.data.title || 'Unknown',
                    artist: data.data.artist || 'Unknown',
                    downloadUrl: `https://sayobot.cn/beatmaps/download/full/${data.data.sid}`,
                    source: 'Sayobot (MD5)',
                };
            }
        }
        catch {
            // Ignore network errors
        }
        return null;
    }
    parseReplayFilename(filename) {
        let name = path.basename(filename);
        if (name.includes(' playing ')) {
            name = name.split(' playing ')[1];
        }
        // Strip trailing timestamp e.g. (2026-07-15_16-53).osr
        name = name.replace(/\s*\(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\)\.osr$/i, '');
        name = name.replace(/\.osr$/i, '').trim();
        let diff;
        const diffMatch = name.match(/\[(.*?)\]$/);
        if (diffMatch) {
            diff = diffMatch[1].trim();
            name = name.slice(0, diffMatch.index).trim();
        }
        let creator;
        const creatorMatch = name.match(/\((.*?)\)$/);
        if (creatorMatch) {
            creator = creatorMatch[1].trim();
            name = name.slice(0, creatorMatch.index).trim();
        }
        let artist;
        let title = name;
        if (name.includes(' - ')) {
            const parts = name.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }
        return { artist, title, creator, diff };
    }
    async searchMirrorWithMetadata(meta) {
        const queries = [];
        if (meta.artist && meta.title) {
            queries.push(`${meta.artist} ${meta.title}`);
        }
        if (meta.title) {
            queries.push(meta.title);
        }
        if (meta.artist) {
            queries.push(meta.artist);
        }
        const creatorTarget = (meta.creator || '').toLowerCase().trim();
        const diffTarget = (meta.diff || '').toLowerCase().trim();
        for (const q of queries) {
            const cleanQ = encodeURIComponent(q);
            const url = `https://catboy.best/api/v2/search?q=${cleanQ}`;
            try {
                const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
                if (!resp.ok)
                    continue;
                const results = await resp.json();
                if (Array.isArray(results) && results.length > 0) {
                    // 1. Look for matching creator
                    if (creatorTarget) {
                        for (const item of results) {
                            const c = (item.creator || (item.user && item.user.username) || '').toLowerCase().trim();
                            if (c === creatorTarget) {
                                return {
                                    beatmapSetId: item.id,
                                    title: item.title || q,
                                    artist: item.artist || 'Unknown',
                                    downloadUrl: `https://catboy.best/d/${item.id}`,
                                    source: `Catboy/Mino (Creator: ${meta.creator})`,
                                };
                            }
                        }
                    }
                    // 2. Look for matching difficulty
                    if (diffTarget) {
                        for (const item of results) {
                            for (const b of item.beatmaps || []) {
                                if ((b.version || '').toLowerCase().trim() === diffTarget) {
                                    return {
                                        beatmapSetId: item.id,
                                        title: item.title || q,
                                        artist: item.artist || 'Unknown',
                                        downloadUrl: `https://catboy.best/d/${item.id}`,
                                        source: `Catboy/Mino (Difficulty: ${meta.diff})`,
                                    };
                                }
                            }
                        }
                    }
                    // 3. First result fallback
                    if (!creatorTarget) {
                        const first = results[0];
                        return {
                            beatmapSetId: first.id,
                            title: first.title || q,
                            artist: first.artist || 'Unknown',
                            downloadUrl: `https://catboy.best/d/${first.id}`,
                            source: 'Catboy/Mino (Search)',
                        };
                    }
                }
            }
            catch {
                // Continue to next query
            }
        }
        return null;
    }
    async resolveBeatmap(md5, filenameHint) {
        // 1. Try MD5 lookups
        const catboyInfo = await this.fetchByMd5Catboy(md5);
        if (catboyInfo)
            return catboyInfo;
        const sayobotInfo = await this.fetchByMd5Sayobot(md5);
        if (sayobotInfo)
            return sayobotInfo;
        // 2. Fallback: Parse filename metadata and search
        if (filenameHint) {
            const meta = this.parseReplayFilename(filenameHint);
            console.log(`🔍 Searching mirror servers for: '${meta.artist || ''} - ${meta.title || ''}' (Mapper: ${meta.creator || 'Any'})...`);
            const searchInfo = await this.searchMirrorWithMetadata(meta);
            if (searchInfo)
                return searchInfo;
        }
        return null;
    }
    async ensureBeatmap(md5, filenameHint) {
        const info = await this.resolveBeatmap(md5, filenameHint);
        if (!info) {
            return { success: false, message: `Could not resolve beatmap (MD5: ${md5}) on any mirror.` };
        }
        const sid = info.beatmapSetId;
        const title = info.title;
        const artist = info.artist;
        const targetOsz = path.join(this.songsDir, `${sid}.osz`);
        const targetExtracted = path.join(this.songsDir, String(sid));
        if (fs.existsSync(targetOsz) || fs.existsSync(targetExtracted)) {
            return { success: true, message: `Beatmap '${artist} - ${title}' (Set #${sid}) is already present.` };
        }
        console.log(`⚡ Downloading beatmap: ${artist} - ${title} (Set #${sid}) from ${info.source}...`);
        try {
            const resp = await fetch(info.downloadUrl, { headers: { 'User-Agent': USER_AGENT } });
            if (!resp.ok || !resp.body) {
                return { success: false, message: `HTTP Error ${resp.status} while downloading from ${info.downloadUrl}` };
            }
            const totalBytes = Number(resp.headers.get('content-length')) || 0;
            let downloaded = 0;
            const fileStream = fs.createWriteStream(targetOsz);
            const reader = resp.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (value) {
                    fileStream.write(Buffer.from(value));
                    downloaded += value.length;
                    if (totalBytes > 0) {
                        const percent = Math.floor((downloaded * 100) / totalBytes);
                        process.stdout.write(`\r📥 Progress: ${percent}% (${Math.floor(downloaded / 1024)} KB / ${Math.floor(totalBytes / 1024)} KB)`);
                    }
                }
            }
            fileStream.end();
            console.log('\n✅ Download completed successfully!');
            return { success: true, message: `Downloaded '${artist} - ${title}' (Set #${sid})` };
        }
        catch (e) {
            if (fs.existsSync(targetOsz)) {
                fs.unlinkSync(targetOsz);
            }
            return { success: false, message: `Failed to download: ${e.message}` };
        }
    }
}
exports.BeatmapFetcher = BeatmapFetcher;
//# sourceMappingURL=fetcher.js.map