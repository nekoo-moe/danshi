"use strict";
/**
 * Beatmap Auto-Fetcher in TypeScript.
 * Resolves Beatmap MD5 checksums and fallback text queries across multiple mirror APIs:
 * Catboy/Mino, Sayobot, osu.direct, Nerinyan.
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
const ui_1 = require("./ui");
const calculator_1 = require("./calculator");
const USER_AGENT = 'danser-autofetch/1.3.7 (https://github.com/heiznerd/danser-autofetch)';
class BeatmapFetcher {
    songsDir;
    constructor(songsDir) {
        this.songsDir = path.resolve(songsDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
        if (!fs.existsSync(this.songsDir)) {
            fs.mkdirSync(this.songsDir, { recursive: true });
        }
    }
    static getDownloadCandidates(sid) {
        return [
            { name: 'Catboy/Mino', url: `https://catboy.best/d/${sid}` },
            { name: 'Sayobot (Full)', url: `https://dl.sayobot.cn/beatmaps/download/full/${sid}` },
            { name: 'osu.direct', url: `https://osu.direct/api/d/${sid}` },
            { name: 'Nerinyan', url: `https://api.nerinyan.moe/d/${sid}` },
            { name: 'Sayobot (Mini)', url: `https://dl.sayobot.cn/beatmaps/download/mini/${sid}` },
        ];
    }
    async fetchByMd5Catboy(md5) {
        const url = `https://catboy.best/api/v2/md5/${md5}`;
        try {
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            const sid = data.beatmapset_id || (data.set && data.set.id);
            const title = (data.set && (data.set.title || data.set.title_unicode)) || data.title || 'Unknown';
            const artist = (data.set && (data.set.artist || data.set.artist_unicode)) || data.artist || 'Unknown';
            const version = data.version;
            const creator = (data.set && data.set.creator) || data.creator;
            if (sid) {
                return {
                    beatmapSetId: sid,
                    title,
                    artist,
                    version,
                    creator,
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
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            if (data.status === 0 && data.data && data.data.sid) {
                return {
                    beatmapSetId: data.data.sid,
                    title: data.data.title || 'Unknown',
                    artist: data.data.artist || 'Unknown',
                    version: data.data.version,
                    creator: data.data.creator,
                    downloadUrl: `https://dl.sayobot.cn/beatmaps/download/full/${data.data.sid}`,
                    source: 'Sayobot (MD5)',
                };
            }
        }
        catch {
            // Ignore network errors
        }
        return null;
    }
    async fetchByMd5OsuDirect(md5) {
        const url = `https://osu.direct/api/v2/md5/${md5}`;
        try {
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            const sid = data.beatmapset_id;
            if (sid) {
                let title = 'Unknown';
                let artist = 'Unknown';
                let creator = data.creator;
                try {
                    const sResp = await fetch(`https://osu.direct/api/s/${sid}`, {
                        headers: { 'User-Agent': USER_AGENT },
                        signal: AbortSignal.timeout(3000),
                    });
                    if (sResp.ok) {
                        const sData = await sResp.json();
                        title = sData.Title || title;
                        artist = sData.Artist || artist;
                        creator = sData.Creator || creator;
                    }
                }
                catch { }
                return {
                    beatmapSetId: sid,
                    title,
                    artist,
                    version: data.version,
                    creator,
                    downloadUrl: `https://catboy.best/d/${sid}`,
                    source: 'osu.direct (MD5)',
                };
            }
        }
        catch {
            // Ignore network errors
        }
        return null;
    }
    async fetchByBeatmapId(bid) {
        // 1. Try osu.direct /api/b/
        try {
            const url = `https://osu.direct/api/b/${bid}`;
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (resp.ok) {
                const data = await resp.json();
                const sid = data.ParentSetID;
                if (sid) {
                    let title = 'Unknown';
                    let artist = 'Unknown';
                    let creator;
                    try {
                        const sResp = await fetch(`https://osu.direct/api/s/${sid}`, {
                            headers: { 'User-Agent': USER_AGENT },
                            signal: AbortSignal.timeout(3000),
                        });
                        if (sResp.ok) {
                            const sData = await sResp.json();
                            title = sData.Title || title;
                            artist = sData.Artist || artist;
                            creator = sData.Creator;
                        }
                    }
                    catch { }
                    return {
                        beatmapSetId: sid,
                        title,
                        artist,
                        version: data.DiffName,
                        creator,
                        downloadUrl: `https://catboy.best/d/${sid}`,
                        source: `osu.direct (Beatmap #${bid})`,
                    };
                }
            }
        }
        catch { }
        // 2. Try Catboy /api/v2/b/
        try {
            const url = `https://catboy.best/api/v2/b/${bid}`;
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (resp.ok) {
                const data = await resp.json();
                const sid = data.beatmapset_id;
                if (sid) {
                    let title = (data.set && (data.set.title || data.set.title_unicode)) || 'Unknown';
                    let artist = (data.set && (data.set.artist || data.set.artist_unicode)) || 'Unknown';
                    let creator = (data.owners && data.owners[0] && data.owners[0].username) || (data.set && data.set.creator);
                    if (title === 'Unknown') {
                        try {
                            const sResp = await fetch(`https://catboy.best/api/v2/s/${sid}`, {
                                headers: { 'User-Agent': USER_AGENT },
                                signal: AbortSignal.timeout(3000),
                            });
                            if (sResp.ok) {
                                const sData = await sResp.json();
                                title = sData.title || title;
                                artist = sData.artist || artist;
                                creator = creator || sData.creator;
                            }
                        }
                        catch { }
                    }
                    return {
                        beatmapSetId: sid,
                        title,
                        artist,
                        version: data.version,
                        creator,
                        downloadUrl: `https://catboy.best/d/${sid}`,
                        source: `Catboy (Beatmap #${bid})`,
                    };
                }
            }
        }
        catch { }
        // 3. Try Sayobot T=0
        try {
            const url = `https://api.sayobot.cn/v2/beatmapinfo?K=${bid}&T=0`;
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (resp.ok) {
                const data = await resp.json();
                if (data.status === 0 && data.data && data.data.sid) {
                    return {
                        beatmapSetId: data.data.sid,
                        title: data.data.title || 'Unknown',
                        artist: data.data.artist || 'Unknown',
                        creator: data.data.creator,
                        downloadUrl: `https://dl.sayobot.cn/beatmaps/download/full/${data.data.sid}`,
                        source: `Sayobot (Beatmap #${bid})`,
                    };
                }
            }
        }
        catch { }
        return null;
    }
    async fetchByMd5Nerinyan(md5) {
        const url = `https://api.nerinyan.moe/search?q=${md5}`;
        try {
            const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
                const item = data[0];
                return {
                    beatmapSetId: item.id,
                    title: item.title || 'Unknown',
                    artist: item.artist || 'Unknown',
                    creator: item.creator,
                    downloadUrl: `https://api.nerinyan.moe/d/${item.id}`,
                    source: 'Nerinyan (MD5)',
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
        // 1. Check for osu! lazer exported replay pattern: (solo-)?replay-osu_{beatmapId}_{scoreId}.osr or osu_{beatmapId}_{scoreId}.osr
        let beatmapId;
        const lazerIdMatch = name.match(/^(?:solo-)?replay-osu_(\d+)_/i) || name.match(/^osu_(\d+)_/i) || name.match(/^(\d+)_\d+\.osr$/i);
        if (lazerIdMatch) {
            beatmapId = parseInt(lazerIdMatch[1], 10);
            return { beatmapId };
        }
        // 2. Strip trailing timestamp e.g. (2026-09-01_10-29).osr
        name = name.replace(/\s*\(\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2}(?:-\d{2})?)?\)\.osr$/i, '');
        name = name.replace(/\.osr$/i, '').trim();
        // If name matches the pure lazer pattern without metadata, avoid using it as search title
        if (/^(?:solo-)?replay-osu_\d+/i.test(name) || /^osu_\d+/i.test(name)) {
            return { beatmapId };
        }
        // 3. Extract difficulty from trailing brackets [DiffName]
        let diff;
        const diffMatch = name.match(/\[([^\[\]]*)\]$/);
        if (diffMatch) {
            diff = diffMatch[1].trim();
            name = name.slice(0, diffMatch.index).trim();
        }
        // 4. Extract mapper from trailing parentheses (Mapper)
        let creator;
        const creatorMatch = name.match(/\(([^()]*)\)$/);
        if (creatorMatch) {
            creator = creatorMatch[1].trim();
            name = name.slice(0, creatorMatch.index).trim();
        }
        // 5. Strip '{player} playing ' prefix from in-game lazer exports
        if (name.includes(' playing ')) {
            name = name.split(' playing ').slice(1).join(' playing ').trim();
        }
        // 6. Split Artist and Title
        let artist;
        let title = name;
        if (name.includes(' - ')) {
            const parts = name.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }
        return { artist, title, creator, diff, beatmapId };
    }
    async searchMirrorWithMetadata(meta) {
        const queries = [];
        const cleanTitle = (meta.title || '').replace(/\s*\([^)]*\)/g, '').trim();
        // Build intelligent prioritized query strings
        if (meta.creator && cleanTitle) {
            queries.push(`${meta.creator} ${cleanTitle}`);
        }
        if (meta.creator && meta.artist && cleanTitle) {
            queries.push(`${meta.creator} ${meta.artist} ${cleanTitle}`);
        }
        if (meta.artist && cleanTitle) {
            queries.push(`${meta.artist} ${cleanTitle}`);
            queries.push(`${meta.artist} ${meta.title}`);
        }
        if (cleanTitle) {
            queries.push(cleanTitle);
        }
        if (meta.title && meta.title !== cleanTitle) {
            queries.push(meta.title);
        }
        if (meta.creator) {
            queries.push(meta.creator);
        }
        const creatorTarget = (meta.creator || '').toLowerCase().trim();
        const diffTarget = (meta.diff || '').toLowerCase().trim();
        for (const q of queries) {
            const cleanQ = encodeURIComponent(q);
            // 1. Try osu.direct search
            try {
                const url = `https://osu.direct/api/search?q=${cleanQ}`;
                const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
                if (resp.ok) {
                    const results = await resp.json();
                    if (Array.isArray(results) && results.length > 0) {
                        for (const item of results) {
                            const c = (item.Creator || '').toLowerCase().trim();
                            if (!creatorTarget || c === creatorTarget) {
                                let matchedBid;
                                if (Array.isArray(item.ChildrenBeatmaps) && diffTarget) {
                                    const matched = item.ChildrenBeatmaps.find((b) => b.DiffName && b.DiffName.toLowerCase().trim() === diffTarget);
                                    if (matched && matched.BeatmapID) {
                                        matchedBid = matched.BeatmapID;
                                        meta.beatmapId = matchedBid;
                                    }
                                }
                                return {
                                    beatmapSetId: item.SetID,
                                    beatmapId: matchedBid || meta.beatmapId,
                                    title: item.Title || q,
                                    artist: item.Artist || 'Unknown',
                                    creator: item.Creator,
                                    downloadUrl: `https://catboy.best/d/${item.SetID}`,
                                    source: `osu.direct (${item.Creator ? `Creator: ${item.Creator}` : 'Search'})`,
                                };
                            }
                        }
                    }
                }
            }
            catch {
                // Continue
            }
            // 2. Try Catboy search
            try {
                const url = `https://catboy.best/api/v2/search?q=${cleanQ}`;
                const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
                if (resp.ok) {
                    const results = await resp.json();
                    if (Array.isArray(results) && results.length > 0) {
                        for (const item of results) {
                            const c = (item.creator || (item.user && item.user.username) || '').toLowerCase().trim();
                            if (!creatorTarget || c === creatorTarget) {
                                if (Array.isArray(item.beatmaps) && diffTarget) {
                                    const matchedDiff = item.beatmaps.find((b) => b.version && b.version.toLowerCase().trim() === diffTarget);
                                    if (matchedDiff && matchedDiff.id) {
                                        meta.beatmapId = matchedDiff.id;
                                    }
                                }
                                return {
                                    beatmapSetId: item.id,
                                    title: item.title || q,
                                    artist: item.artist || 'Unknown',
                                    creator: item.creator,
                                    downloadUrl: `https://catboy.best/d/${item.id}`,
                                    source: `Catboy/Mino (${item.creator ? `Creator: ${item.creator}` : 'Search'})`,
                                };
                            }
                        }
                    }
                }
            }
            catch {
                // Continue
            }
            // 3. Try Sayobot search
            try {
                const url = `https://api.sayobot.cn/beatmaplist?0=20&1=0&2=4&8=2&100=${cleanQ}`;
                const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
                if (resp.ok) {
                    const data = await resp.json();
                    const list = data.data || [];
                    if (Array.isArray(list) && list.length > 0) {
                        for (const item of list) {
                            const c = (item.creator || '').toLowerCase().trim();
                            if (!creatorTarget || c === creatorTarget) {
                                return {
                                    beatmapSetId: item.sid,
                                    title: item.title || q,
                                    artist: item.artist || 'Unknown',
                                    creator: item.creator,
                                    downloadUrl: `https://dl.sayobot.cn/beatmaps/download/full/${item.sid}`,
                                    source: `Sayobot (${item.creator ? `Creator: ${item.creator}` : 'Search'})`,
                                };
                            }
                        }
                    }
                }
            }
            catch {
                // Continue
            }
            // 4. Try Nerinyan search
            try {
                const url = `https://api.nerinyan.moe/search?q=${cleanQ}`;
                const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
                if (resp.ok) {
                    const results = await resp.json();
                    if (Array.isArray(results) && results.length > 0) {
                        for (const item of results) {
                            const c = (item.creator || '').toLowerCase().trim();
                            if (!creatorTarget || c === creatorTarget) {
                                return {
                                    beatmapSetId: item.id,
                                    title: item.title || q,
                                    artist: item.artist || 'Unknown',
                                    creator: item.creator,
                                    downloadUrl: `https://api.nerinyan.moe/d/${item.id}`,
                                    source: `Nerinyan (${item.creator ? `Creator: ${item.creator}` : 'Search'})`,
                                };
                            }
                        }
                    }
                }
            }
            catch {
                // Continue
            }
        }
        return null;
    }
    async resolveBeatmap(md5, filenameHint, onProgress) {
        // 1. Try MD5 lookups across all mirrors
        if (onProgress) {
            onProgress({ processName: 'fetch', percent: 0, log: 'querying catboy/mino mirror (md5)...' });
        }
        const catboyInfo = await this.fetchByMd5Catboy(md5);
        if (catboyInfo)
            return catboyInfo;
        if (onProgress) {
            onProgress({ processName: 'fetch', percent: 0, log: 'querying osu.direct mirror (md5)...' });
        }
        const osuDirectInfo = await this.fetchByMd5OsuDirect(md5);
        if (osuDirectInfo)
            return osuDirectInfo;
        if (onProgress) {
            onProgress({ processName: 'fetch', percent: 0, log: 'querying sayobot mirror (md5)...' });
        }
        const sayobotInfo = await this.fetchByMd5Sayobot(md5);
        if (sayobotInfo)
            return sayobotInfo;
        if (onProgress) {
            onProgress({ processName: 'fetch', percent: 0, log: 'querying nerinyan mirror (md5)...' });
        }
        const nerinyanInfo = await this.fetchByMd5Nerinyan(md5);
        if (nerinyanInfo)
            return nerinyanInfo;
        // 2. Try Beatmap ID if extracted from replay filename (osu! lazer format)
        if (filenameHint) {
            const meta = this.parseReplayFilename(filenameHint);
            if (meta.beatmapId) {
                if (onProgress) {
                    onProgress({ processName: 'fetch', percent: 0, log: `querying lazer beatmap id #${meta.beatmapId}...` });
                }
                else {
                    (0, ui_1.printStatus)('lookup', `detected osu! lazer beatmap id #${meta.beatmapId} from filename`);
                }
                const bidInfo = await this.fetchByBeatmapId(meta.beatmapId);
                if (bidInfo)
                    return bidInfo;
            }
            // 3. Fallback: Search mirrors by artist / song title
            if (meta.title && meta.title.length > 2) {
                const queryDesc = `'${(meta.artist || '').toLowerCase()} - ${(meta.title || '').toLowerCase()}'`;
                if (onProgress) {
                    onProgress({ processName: 'fetch', percent: 0, log: `searching mirrors for ${queryDesc}...` });
                }
                else {
                    (0, ui_1.printStatus)('search', `querying mirror servers for: ${queryDesc}`);
                }
                const searchInfo = await this.searchMirrorWithMetadata(meta);
                if (searchInfo)
                    return searchInfo;
            }
        }
        return null;
    }
    async downloadFromMirrors(sid, targetOsz, onProgress) {
        const candidates = BeatmapFetcher.getDownloadCandidates(sid);
        for (const mirror of candidates) {
            try {
                if (onProgress) {
                    onProgress({ processName: 'mirror', percent: 0, log: `connecting to ${mirror.name.toLowerCase()}...` });
                }
                else {
                    (0, ui_1.printStatus)('mirror', `connecting to ${mirror.name.toLowerCase()}...`);
                }
                const resp = await fetch(mirror.url, {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(30000),
                });
                if (!resp.ok || !resp.body) {
                    if (onProgress) {
                        onProgress({ processName: 'mirror', log: `${mirror.name.toLowerCase()} returned http ${resp.status}` });
                    }
                    else {
                        (0, ui_1.printStatus)('mirror', `${mirror.name.toLowerCase()} returned http ${resp.status}`, 'warning');
                    }
                    continue;
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
                            const percent = (downloaded * 100) / totalBytes;
                            const downMb = (downloaded / (1024 * 1024)).toFixed(1);
                            const totMb = (totalBytes / (1024 * 1024)).toFixed(1);
                            if (onProgress) {
                                onProgress({
                                    processName: 'mirror',
                                    percent,
                                    detail: `${downMb} / ${totMb} mb`,
                                    log: `downloading set #${sid} from ${mirror.name.toLowerCase()}...`,
                                });
                            }
                            else {
                                (0, ui_1.renderProgress)('download', downloaded, totalBytes, 'kb');
                            }
                        }
                    }
                }
                fileStream.end();
                if (!onProgress)
                    (0, ui_1.finishProgress)();
                // Validate downloaded file is larger than 10KB (avoid HTML error pages)
                if (fs.existsSync(targetOsz) && fs.statSync(targetOsz).size > 10240) {
                    if (onProgress) {
                        onProgress({
                            processName: 'mirror',
                            percent: 100,
                            detail: 'downloaded',
                            log: `downloaded set #${sid} from ${mirror.name.toLowerCase()}`,
                        });
                    }
                    else {
                        (0, ui_1.printStatus)('mirror', `downloaded set #${sid} from ${mirror.name.toLowerCase()}`, 'success');
                    }
                    return true;
                }
                else {
                    if (fs.existsSync(targetOsz))
                        fs.unlinkSync(targetOsz);
                }
            }
            catch (err) {
                if (onProgress) {
                    onProgress({ processName: 'mirror', log: `${mirror.name.toLowerCase()} failed: ${err.message.toLowerCase()}` });
                }
                else {
                    (0, ui_1.printStatus)('mirror', `${mirror.name.toLowerCase()} failed: ${err.message.toLowerCase()}`, 'warning');
                }
                if (fs.existsSync(targetOsz))
                    fs.unlinkSync(targetOsz);
            }
        }
        return false;
    }
    async ensureBeatmap(md5, filenameHint, onProgress) {
        // 0. Quick local cache check before querying mirrors
        const existingOsu = calculator_1.PPCalculator.findOsuFileInSongs(this.songsDir, md5);
        if (existingOsu) {
            return { success: true, message: 'beatmap is already present in songs folder.' };
        }
        const info = await this.resolveBeatmap(md5, filenameHint, onProgress);
        if (!info) {
            return { success: false, message: `could not resolve beatmap (md5: ${md5.toLowerCase()}) on any mirror.` };
        }
        const sid = info.beatmapSetId;
        const title = info.title;
        const artist = info.artist;
        const targetOsz = path.join(this.songsDir, `${sid}.osz`);
        const targetExtracted = path.join(this.songsDir, String(sid));
        if (fs.existsSync(targetOsz) || fs.existsSync(targetExtracted)) {
            return { success: true, message: `beatmap '${artist.toLowerCase()} - ${title.toLowerCase()}' (set #${sid}) is already present.` };
        }
        if (onProgress) {
            onProgress({
                processName: 'fetch',
                percent: 0,
                log: `fetching beatmap: ${artist.toLowerCase()} - ${title.toLowerCase()} (set #${sid})...`,
            });
        }
        else {
            (0, ui_1.printStatus)('fetch', `fetching beatmap: ${artist.toLowerCase()} - ${title.toLowerCase()} (set #${sid})...`);
        }
        const downloaded = await this.downloadFromMirrors(sid, targetOsz, onProgress);
        if (downloaded) {
            return { success: true, message: `downloaded '${artist.toLowerCase()} - ${title.toLowerCase()}' (set #${sid})` };
        }
        return { success: false, message: `failed to download beatmap from all mirrors for set #${sid}.` };
    }
}
exports.BeatmapFetcher = BeatmapFetcher;
//# sourceMappingURL=fetcher.js.map