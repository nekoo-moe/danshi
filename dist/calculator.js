"use strict";
/**
 * Modern Performance Points (PP) & Star Rating Calculator (2026 Update).
 * Powered by rosu-pp-js (Rust WebAssembly implementation matching the latest official osu! reworks).
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
exports.PPCalculator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const rosu_pp_js_1 = require("rosu-pp-js");
class PPCalculator {
    /**
     * Calculates modern 2026 PP and Star Rating for a replay against its .osu beatmap.
     */
    static calculate(osuFilePathOrContent, replay) {
        try {
            let content;
            if (typeof osuFilePathOrContent === 'string') {
                if (!fs.existsSync(osuFilePathOrContent))
                    return null;
                content = fs.readFileSync(osuFilePathOrContent);
            }
            else {
                content = osuFilePathOrContent;
            }
            const map = new rosu_pp_js_1.Beatmap(content);
            // 1. Calculate actual play performance
            const playPerf = new rosu_pp_js_1.Performance({
                mods: replay.modsInt,
                n300: replay.count300,
                n100: replay.count100,
                n50: replay.count50,
                misses: replay.countMiss,
                combo: replay.maxCombo,
            });
            const playResult = playPerf.calculate(map);
            // 2. Calculate 100% SS maximum performance
            const ssPerf = new rosu_pp_js_1.Performance({
                mods: replay.modsInt,
            });
            const ssResult = ssPerf.calculate(map);
            return {
                stars: Number(playResult.difficulty.stars.toFixed(2)),
                aimStars: Number((playResult.difficulty.aim ?? 0).toFixed(2)),
                speedStars: Number((playResult.difficulty.speed ?? 0).toFixed(2)),
                totalPP: Number(playResult.pp.toFixed(2)),
                aimPP: Number((playResult.ppAim ?? 0).toFixed(2)),
                speedPP: Number((playResult.ppSpeed ?? 0).toFixed(2)),
                accPP: Number((playResult.ppAccuracy ?? 0).toFixed(2)),
                flashlightPP: Number((playResult.ppFlashlight ?? 0).toFixed(2)),
                maxCombo: playResult.difficulty.maxCombo ?? 0,
                ssPP: Number(ssResult.pp.toFixed(2)),
            };
        }
        catch (e) {
            console.warn(`⚠️ Warning: Could not calculate modern PP: ${e.message}`);
            return null;
        }
    }
    /**
     * Finds the .osu difficulty file in the Songs directory matching a beatmap MD5 or difficulty name.
     */
    static findOsuFileInSongs(songsDir, beatmapMd5, diffHint) {
        if (!fs.existsSync(songsDir))
            return null;
        for (const entry of fs.readdirSync(songsDir)) {
            const fullPath = path.join(songsDir, entry);
            if (fs.statSync(fullPath).isDirectory()) {
                for (const file of fs.readdirSync(fullPath)) {
                    if (file.endsWith('.osu')) {
                        const osuP = path.join(fullPath, file);
                        if (diffHint && file.toLowerCase().includes(`[${diffHint.toLowerCase()}]`)) {
                            return osuP;
                        }
                    }
                }
            }
        }
        return null;
    }
}
exports.PPCalculator = PPCalculator;
//# sourceMappingURL=calculator.js.map