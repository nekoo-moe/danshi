"use strict";
/**
 * Danser Execution & Rendering module in TypeScript (Cross-Platform).
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
exports.DanserRenderer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class DanserRenderer {
    danserDir;
    outputDir;
    settingsFile;
    danserBin;
    constructor(danserDir, outputDir) {
        this.danserDir = DanserRenderer.resolveDanserDir(danserDir);
        this.outputDir = outputDir
            ? path.resolve(outputDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''))
            : path.join(this.danserDir, 'videos');
        this.settingsFile = path.join(this.danserDir, 'settings', 'default.json');
        this.danserBin = this.resolveDanserBinary();
    }
    static resolveDanserDir(userPath) {
        if (userPath) {
            const resolved = path.resolve(userPath.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
            if (fs.existsSync(resolved)) {
                return resolved;
            }
        }
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const candidates = [
            path.join(home, 'Applications', 'danser'),
            path.join(home, '.danser'),
            path.resolve('./danser'),
            path.resolve('.'),
        ];
        if (process.platform === 'win32') {
            const localAppData = process.env.LOCALAPPDATA || '';
            const appData = process.env.APPDATA || '';
            const programFiles = process.env.ProgramFiles || '';
            if (localAppData) {
                candidates.push(path.join(localAppData, 'Programs', 'danser'), path.join(localAppData, 'danser'));
            }
            if (appData) {
                candidates.push(path.join(appData, 'danser'));
            }
            if (programFiles) {
                candidates.push(path.join(programFiles, 'danser'));
            }
        }
        else if (process.platform === 'darwin') {
            candidates.push(path.join(home, 'Library', 'Application Support', 'danser'));
        }
        for (const c of candidates) {
            if (c &&
                fs.existsSync(c) &&
                (fs.existsSync(path.join(c, 'settings')) ||
                    fs.existsSync(path.join(c, 'danser')) ||
                    fs.existsSync(path.join(c, 'danser.exe')))) {
                return c;
            }
        }
        return path.resolve(userPath || candidates[0]);
    }
    resolveDanserBinary() {
        const isWindows = process.platform === 'win32';
        const binNames = isWindows ? ['danser-cli.exe', 'danser.exe'] : ['danser-cli', 'danser'];
        // 1. Search inside danserDir
        for (const name of binNames) {
            const p = path.join(this.danserDir, name);
            if (fs.existsSync(p)) {
                return p;
            }
        }
        return path.join(this.danserDir, binNames[0]);
    }
    configureSettings(options = {}) {
        if (!fs.existsSync(this.settingsFile)) {
            return;
        }
        try {
            const raw = fs.readFileSync(this.settingsFile, 'utf-8');
            const cfg = JSON.parse(raw);
            const useSkinCursor = options.useSkinCursor ?? true;
            const useSkinHitsounds = options.useSkinHitsounds ?? true;
            const useSkinColors = options.useSkinColors ?? true;
            const skipLeadIn = options.skipLeadIn ?? true;
            const fps = options.fps ?? 60;
            const resolution = options.resolution ?? [1920, 1080];
            // Paths
            cfg.General = cfg.General || {};
            cfg.General.OsuSongsDir = path.join(this.danserDir, 'Songs');
            cfg.General.OsuSkinsDir = path.join(this.danserDir, 'Skins');
            cfg.General.OsuReplaysDir = path.join(this.danserDir, 'Replays');
            cfg.General.UnpackOszFiles = true;
            // Skin
            cfg.Skin = cfg.Skin || {};
            cfg.Skin.UseColorsFromSkin = useSkinColors;
            cfg.Skin.UseBeatmapColors = !useSkinColors;
            cfg.Skin.Cursor = cfg.Skin.Cursor || {};
            cfg.Skin.Cursor.UseSkinCursor = useSkinCursor;
            // Audio / Hitsounds
            cfg.Audio = cfg.Audio || {};
            cfg.Audio.IgnoreBeatmapSamples = useSkinHitsounds;
            // Gameplay
            cfg.Gameplay = cfg.Gameplay || {};
            cfg.Gameplay.PPVersion = 'latest';
            if (skipLeadIn) {
                cfg.Gameplay.LeadInTime = 0;
                cfg.Gameplay.LeadInHold = 0;
            }
            if (cfg.Gameplay.SeizureWarning) {
                cfg.Gameplay.SeizureWarning.Enabled = false;
            }
            // PPCounter
            cfg.Gameplay.PPCounter = cfg.Gameplay.PPCounter || {};
            cfg.Gameplay.PPCounter.Show = true;
            cfg.Gameplay.PPCounter.ShowPPComponents = true;
            // Recording
            if (cfg.Recording) {
                cfg.Recording.FrameWidth = resolution[0];
                cfg.Recording.FrameHeight = resolution[1];
                cfg.Recording.FPS = fps;
                cfg.Recording.Encoder = 'libx264';
            }
            fs.writeFileSync(this.settingsFile, JSON.stringify(cfg, null, 4), 'utf-8');
        }
        catch (e) {
            console.log(`⚠️ Warning: Could not update Danser config: ${e.message}`);
        }
    }
    runRecord(replayPath, skinName, extraArgs = []) {
        return new Promise((resolve) => {
            const env = { ...process.env };
            const bundledFfmpeg = path.join(this.danserDir, 'ffmpeg');
            if (fs.existsSync(bundledFfmpeg)) {
                if (process.platform === 'win32') {
                    env.PATH = `${bundledFfmpeg};${env.PATH || ''}`;
                }
                else if (process.platform === 'darwin') {
                    env.PATH = `${bundledFfmpeg}:${env.PATH || ''}`;
                    env.DYLD_LIBRARY_PATH = `${bundledFfmpeg}:${this.danserDir}:${env.DYLD_LIBRARY_PATH || ''}`;
                }
                else {
                    env.PATH = `${bundledFfmpeg}:${env.PATH || ''}`;
                    env.LD_LIBRARY_PATH = `${bundledFfmpeg}:${this.danserDir}:${env.LD_LIBRARY_PATH || ''}`;
                }
            }
            const args = ['-record', '-skip', '-replay', path.resolve(replayPath)];
            if (skinName) {
                args.push('-skin', skinName);
            }
            if (extraArgs.length > 0) {
                args.push(...extraArgs);
            }
            console.log(`\n🚀 Launching Danser: ${this.danserBin} ${args.join(' ')}`);
            const child = (0, child_process_1.spawn)(this.danserBin, args, {
                cwd: this.danserDir,
                env,
                stdio: 'inherit',
            });
            child.on('close', (code) => {
                resolve(code ?? 0);
            });
            child.on('error', (err) => {
                console.error(`❌ Failed to start Danser binary: ${err.message}`);
                resolve(1);
            });
        });
    }
}
exports.DanserRenderer = DanserRenderer;
//# sourceMappingURL=renderer.js.map