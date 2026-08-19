"use strict";
/**
 * Auto-Installer & Bootstrapper for Danser-go.
 * Automatically detects OS, downloads the latest Danser-go release, unpacks it,
 * and sets up executable permissions without requiring manual intervention.
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
exports.DanserInstaller = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const USER_AGENT = 'danser-autofetch/1.2.0 (https://github.com/heiznerd/danser-autofetch)';
const GITHUB_API_URL = 'https://api.github.com/repos/Wieku/danser-go/releases/latest';
class DanserInstaller {
    static getPlatformKeyword() {
        if (process.platform === 'win32')
            return 'win';
        if (process.platform === 'darwin')
            return 'mac';
        return 'linux';
    }
    static getDefaultInstallDir() {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        if (process.platform === 'win32') {
            const localAppData = process.env.LOCALAPPDATA;
            if (localAppData) {
                return path.join(localAppData, 'Programs', 'danser');
            }
            return path.join(home, 'Applications', 'danser');
        }
        return path.join(home, 'Applications', 'danser');
    }
    static isDanserInstalled(dir) {
        if (!fs.existsSync(dir))
            return false;
        const isWindows = process.platform === 'win32';
        const binaries = isWindows ? ['danser-cli.exe', 'danser.exe'] : ['danser-cli', 'danser'];
        for (const b of binaries) {
            if (fs.existsSync(path.join(dir, b))) {
                return true;
            }
        }
        return false;
    }
    static async resolveDownloadUrl() {
        const osKey = this.getPlatformKeyword();
        try {
            const resp = await fetch(GITHUB_API_URL, { headers: { 'User-Agent': USER_AGENT } });
            if (resp.ok) {
                const data = await resp.json();
                const assets = data.assets || [];
                for (const asset of assets) {
                    const name = asset.name.toLowerCase();
                    if (name.includes(osKey) && name.endsWith('.zip')) {
                        return {
                            name: asset.name,
                            downloadUrl: asset.browser_download_url,
                            size: asset.size || 0,
                        };
                    }
                }
            }
        }
        catch {
            // Fallback below
        }
        // Default Fallback to 0.11.0 stable release
        const defaultTag = '0.11.0';
        const fallbackFilename = `danser-${defaultTag}-${osKey}.zip`;
        const fallbackUrl = `https://github.com/Wieku/danser-go/releases/download/${defaultTag}/${fallbackFilename}`;
        return {
            name: fallbackFilename,
            downloadUrl: fallbackUrl,
            size: 0,
        };
    }
    static async ensureInstalled(targetDir) {
        const installDir = targetDir
            ? path.resolve(targetDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''))
            : this.getDefaultInstallDir();
        if (this.isDanserInstalled(installDir)) {
            return installDir;
        }
        console.log(`\n[SETUP] Danser-go was not found on this machine.`);
        console.log(`[SETUP] Performing first-boot auto-installation for [${process.platform}]...`);
        console.log(`[SETUP] Target directory: ${installDir}`);
        const asset = await this.resolveDownloadUrl();
        const tempZip = path.join(path.dirname(installDir), `_temp_${asset.name}`);
        if (!fs.existsSync(path.dirname(installDir))) {
            fs.mkdirSync(path.dirname(installDir), { recursive: true });
        }
        console.log(`[DOWNLOAD] Fetching ${asset.name} from GitHub...`);
        try {
            const resp = await fetch(asset.downloadUrl, { headers: { 'User-Agent': USER_AGENT } });
            if (!resp.ok || !resp.body) {
                throw new Error(`Failed to download Danser (HTTP ${resp.status}): ${resp.statusText}`);
            }
            const totalBytes = Number(resp.headers.get('content-length')) || asset.size;
            let downloaded = 0;
            const fileStream = fs.createWriteStream(tempZip);
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
                        process.stdout.write(`\r[PROGRESS] Downloading Danser: ${percent}% (${Math.floor(downloaded / (1024 * 1024))} MB / ${Math.floor(totalBytes / (1024 * 1024))} MB)`);
                    }
                }
            }
            fileStream.end();
            console.log('\n[SETUP] Extracting and configuring Danser-go...');
            if (!fs.existsSync(installDir)) {
                fs.mkdirSync(installDir, { recursive: true });
            }
            const zip = new adm_zip_1.default(tempZip);
            zip.extractAllTo(installDir, true);
            // Clean up temporary zip
            if (fs.existsSync(tempZip)) {
                fs.unlinkSync(tempZip);
            }
            // Make binaries executable on POSIX systems
            if (process.platform !== 'win32') {
                const filesToChmod = ['danser', 'danser-cli', path.join('ffmpeg', 'ffmpeg')];
                for (const f of filesToChmod) {
                    const fullP = path.join(installDir, f);
                    if (fs.existsSync(fullP)) {
                        try {
                            fs.chmodSync(fullP, 0o755);
                        }
                        catch {
                            // Ignore chmod errors
                        }
                    }
                }
            }
            // Initialize default subdirectories
            const subdirs = ['Songs', 'Skins', 'Replays', 'settings', 'videos'];
            for (const sub of subdirs) {
                const p = path.join(installDir, sub);
                if (!fs.existsSync(p)) {
                    fs.mkdirSync(p, { recursive: true });
                }
            }
            console.log(`[SUCCESS] Danser-go has been successfully installed to: ${installDir}\n`);
            return installDir;
        }
        catch (err) {
            if (fs.existsSync(tempZip)) {
                fs.unlinkSync(tempZip);
            }
            throw new Error(`Auto-installation failed: ${err.message}`);
        }
    }
}
exports.DanserInstaller = DanserInstaller;
//# sourceMappingURL=installer.js.map