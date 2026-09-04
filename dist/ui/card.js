"use strict";
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
exports.borderLine = borderLine;
exports.boxedLine = boxedLine;
exports.innerRule = innerRule;
exports.renderMeta = renderMeta;
exports.printBanner = printBanner;
exports.printStatus = printStatus;
exports.renderProgress = renderProgress;
exports.finishProgress = finishProgress;
exports.printReplayCard = printReplayCard;
exports.printCompletionCard = printCompletionCard;
exports.printErrorCard = printErrorCard;
exports.printSkinsList = printSkinsList;
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const theme_1 = require("./theme");
const text_1 = require("./text");
function borderLine(width, left, right, colorFn = theme_1.uiText.border) {
    return colorFn(`${left}${theme_1.glyphs.horizontal.repeat(width - 2)}${right}`);
}
function boxedLine(content, width, leftColor = theme_1.uiText.border, rightColor = theme_1.uiText.border) {
    const left = leftColor(theme_1.glyphs.vertical);
    const right = rightColor(theme_1.glyphs.vertical);
    return `${left} ${(0, text_1.padRight)(content, width - 4)} ${right}`;
}
function innerRule(label, width) {
    const text = label ? chalk_1.default.hex(theme_1.palette.accent)(` ${label.toLowerCase()} `) : '';
    const fill = theme_1.glyphs.horizontal.repeat(Math.max(0, width - (0, text_1.visibleLength)(text)));
    return `${text}${theme_1.uiText.border(fill)}`;
}
function renderMeta(label, value, labelWidth = 12) {
    const paddedLabel = (0, text_1.padRight)(label.toLowerCase(), labelWidth);
    return `${theme_1.uiText.label(paddedLabel)} ${theme_1.uiText.quietValue((0, text_1.cleanInline)(value).toLowerCase())}`;
}
function printBanner(version, subtitle) {
    const width = (0, text_1.terminalWidth)(92, 58);
    const brand = `${theme_1.uiText.brand('danser autofetch')} ${theme_1.uiText.subtle(`v${version.toLowerCase()}`)}`;
    const title = theme_1.uiText.title('replay renderer');
    const sub = subtitle
        ? theme_1.uiText.subtitle(subtitle.toLowerCase())
        : theme_1.uiText.subtitle('automated osu! replay video renderer & multi-mirror beatmap fetcher');
    console.log('');
    // Part-color outline: Top border and header left borders are highlighted with active border blue (#3b82f6)
    console.log(borderLine(width, theme_1.glyphs.topLeft, theme_1.glyphs.topRight, theme_1.uiText.activeBorder));
    console.log(boxedLine(`${brand} ${theme_1.uiText.subtle(theme_1.glyphs.dot)} ${title}`, width, theme_1.uiText.activeBorder, theme_1.uiText.border));
    console.log(boxedLine(sub, width, theme_1.uiText.activeBorder, theme_1.uiText.border));
    console.log(borderLine(width, theme_1.glyphs.bottomLeft, theme_1.glyphs.bottomRight, theme_1.uiText.border));
}
function printStatus(tag, message, type = 'info') {
    const tagColor = type === 'success'
        ? theme_1.uiText.success
        : type === 'warning'
            ? theme_1.uiText.warning
            : type === 'error'
                ? theme_1.uiText.danger
                : theme_1.uiText.tag;
    const tagStr = tagColor(tag.toLowerCase().padEnd(11));
    console.log(` ${theme_1.uiText.subtle(theme_1.glyphs.pointer)} ${tagStr} ${theme_1.uiText.quietValue(message.toLowerCase())}`);
}
function renderProgress(tag, downloaded, total, unit = 'mb') {
    const cleanUnit = unit.toLowerCase();
    const divisor = cleanUnit === 'mb' ? 1024 * 1024 : 1024;
    const percent = total > 0 ? Math.min(100, Math.floor((downloaded * 100) / total)) : 0;
    const barLength = 20;
    const filled = Math.min(barLength, Math.floor((percent / 100) * barLength));
    const empty = barLength - filled;
    const bar = `${theme_1.uiText.success(theme_1.glyphs.barFilled.repeat(filled))}${theme_1.uiText.subtle(theme_1.glyphs.barEmpty.repeat(empty))}`;
    const downStr = (downloaded / divisor).toFixed(1);
    const totStr = total > 0 ? (total / divisor).toFixed(1) : '?';
    const tagStr = theme_1.uiText.tag(tag.toLowerCase().padEnd(11));
    process.stdout.write(`\r ${theme_1.uiText.subtle(theme_1.glyphs.pointer)} ${tagStr} [${bar}] ${percent}% (${downStr} / ${totStr} ${cleanUnit})`);
}
function finishProgress() {
    process.stdout.write('\n');
}
function printReplayCard(replayPath, replay, meta, ppResult) {
    const width = (0, text_1.terminalWidth)(92, 58);
    const innerWidth = width - 4;
    const halfCol = Math.floor((innerWidth - 3) / 2);
    const beatmapTitle = meta?.artist && meta?.title
        ? `${meta.artist} - ${meta.title}${meta.diff ? ` [${meta.diff}]` : ''}`
        : (meta?.title ? `${meta.title}${meta.diff ? ` [${meta.diff}]` : ''}` : path.basename(replayPath));
    const cleanTitle = (0, text_1.truncate)(beatmapTitle.toLowerCase(), innerWidth - 12);
    const modeNames = ['osu! standard', 'taiko', 'catch the beat', 'osu!mania'];
    const modeStr = replay.mode !== undefined && modeNames[replay.mode] ? modeNames[replay.mode] : 'osu! standard';
    // Part-color outline: Top border in active blue (#3b82f6)
    console.log(borderLine(width, theme_1.glyphs.topLeft, theme_1.glyphs.topRight, theme_1.uiText.activeBorder));
    console.log(boxedLine(`${theme_1.uiText.accent('replay')} ${theme_1.uiText.subtle(theme_1.glyphs.dot)} ${theme_1.uiText.title(cleanTitle)}`, width, theme_1.uiText.activeBorder, theme_1.uiText.border));
    console.log(boxedLine(`${theme_1.uiText.label('player:')} ${theme_1.uiText.focus(replay.playerName?.toLowerCase() || 'unknown')}   ${theme_1.uiText.subtle(theme_1.glyphs.dot)}   ${theme_1.uiText.label('mode:')} ${theme_1.uiText.quietValue(modeStr)}`, width, theme_1.uiText.activeBorder, theme_1.uiText.border));
    // Divider between header and data
    console.log(borderLine(width, theme_1.glyphs.teeLeft, theme_1.glyphs.teeRight, theme_1.uiText.border));
    // Two-column layout with part-color left accent border
    function printTwoCols(leftLabel, leftVal, rightLabel, rightVal) {
        const col1 = `${theme_1.uiText.label((0, text_1.padRight)(leftLabel.toLowerCase(), 12))} ${leftVal}`;
        const col2 = `${theme_1.uiText.label((0, text_1.padRight)(rightLabel.toLowerCase(), 12))} ${rightVal}`;
        const paddedCol1 = (0, text_1.padRight)(col1, halfCol);
        const divider = chalk_1.default.hex(theme_1.palette.border)(` ${theme_1.glyphs.vertical} `);
        console.log(boxedLine(`${paddedCol1}${divider}${col2}`, width, theme_1.uiText.border, theme_1.uiText.border));
    }
    const scoreStr = replay.totalScore !== undefined ? replay.totalScore.toLocaleString() : '-';
    const modsStr = (replay.modsString || 'nm').toLowerCase();
    const comboStr = replay.maxCombo !== undefined ? `${replay.maxCombo}x` : '-';
    const statusStr = replay.fullCombo ? theme_1.uiText.success('full combo (fc)') : theme_1.uiText.muted('completed');
    printTwoCols('mods', theme_1.uiText.accent(modsStr), 'score', theme_1.uiText.warning(scoreStr));
    printTwoCols('combo', theme_1.uiText.focus(comboStr), 'status', statusStr);
    const count300 = replay.count300 ?? 0;
    const count100 = replay.count100 ?? 0;
    const count50 = replay.count50 ?? 0;
    const countMiss = replay.countMiss ?? 0;
    const hits300_100 = `${theme_1.uiText.value(String(count300))} ${theme_1.uiText.subtle('/')} ${theme_1.uiText.warning(String(count100))}`;
    const hits50_miss = `${theme_1.uiText.warning(String(count50))} ${theme_1.uiText.subtle('/')} ${countMiss > 0 ? theme_1.uiText.danger(String(countMiss)) : theme_1.uiText.muted('0')}`;
    printTwoCols('300 / 100', hits300_100, '50 / miss', hits50_miss);
    const md5Short = replay.beatmapMd5 ? (0, text_1.truncate)(replay.beatmapMd5.toLowerCase(), halfCol - 15) : '-';
    const setOrBid = meta?.beatmapId ? `#${meta.beatmapId}` : '-';
    printTwoCols('beatmap md5', theme_1.uiText.muted(md5Short), 'beatmap id', theme_1.uiText.focus(setOrBid));
    // Performance Points section if available
    if (ppResult) {
        console.log(borderLine(width, theme_1.glyphs.teeLeft, theme_1.glyphs.teeRight, theme_1.uiText.border));
        console.log(boxedLine(theme_1.uiText.section('performance points (2026 rework)'), width, theme_1.uiText.activeBorder, theme_1.uiText.border));
        console.log(boxedLine(`${theme_1.uiText.label((0, text_1.padRight)('star rating', 12))} ${theme_1.uiText.accent(`${ppResult.stars}★`)} ${theme_1.uiText.muted(`(aim: ${ppResult.aimStars}★ ${theme_1.glyphs.dot} speed: ${ppResult.speedStars}★)`)}`, width, theme_1.uiText.border, theme_1.uiText.border));
        console.log(boxedLine(`${theme_1.uiText.label((0, text_1.padRight)('performance', 12))} ${theme_1.uiText.focus(`${ppResult.totalPP} pp`)} ${theme_1.uiText.muted(`(aim: ${ppResult.aimPP} ${theme_1.glyphs.dot} speed: ${ppResult.speedPP} ${theme_1.glyphs.dot} acc: ${ppResult.accPP})`)}`, width, theme_1.uiText.border, theme_1.uiText.border));
        console.log(boxedLine(`${theme_1.uiText.label((0, text_1.padRight)('if 100% ss', 12))} ${theme_1.uiText.warning(`${ppResult.ssPP} pp`)} ${theme_1.uiText.muted(`(max combo: ${ppResult.maxCombo}x)`)}`, width, theme_1.uiText.border, theme_1.uiText.border));
    }
    console.log(borderLine(width, theme_1.glyphs.bottomLeft, theme_1.glyphs.bottomRight, theme_1.uiText.border));
}
function printCompletionCard(videoPath, resolution, fps, outputDir) {
    const width = (0, text_1.terminalWidth)(92, 58);
    // Part-color outline: Top border in success green (#3fb950)
    console.log(borderLine(width, theme_1.glyphs.topLeft, theme_1.glyphs.topRight, theme_1.uiText.success));
    console.log(boxedLine(`${theme_1.uiText.success('rendering complete')} ${theme_1.uiText.subtle(theme_1.glyphs.dot)} ${theme_1.uiText.title('video encoded')}`, width, theme_1.uiText.success, theme_1.uiText.border));
    console.log(boxedLine(theme_1.uiText.subtitle('replay successfully rendered to mp4'), width, theme_1.uiText.success, theme_1.uiText.border));
    console.log(borderLine(width, theme_1.glyphs.teeLeft, theme_1.glyphs.teeRight, theme_1.uiText.border));
    console.log(boxedLine(`${theme_1.uiText.label((0, text_1.padRight)('destination', 12))} ${theme_1.uiText.focus(videoPath.toLowerCase())}`, width, theme_1.uiText.border, theme_1.uiText.border));
    console.log(boxedLine(`${theme_1.uiText.label((0, text_1.padRight)('directory', 12))} ${theme_1.uiText.muted(outputDir.toLowerCase())}`, width, theme_1.uiText.border, theme_1.uiText.border));
    console.log(boxedLine(`${theme_1.uiText.label((0, text_1.padRight)('format', 12))} ${theme_1.uiText.focus(`${resolution[0]}x${resolution[1]}`)} @ ${theme_1.uiText.quietValue(`${fps} fps`)} ${theme_1.uiText.subtle(theme_1.glyphs.dot)} ${theme_1.uiText.muted('libx264')}`, width, theme_1.uiText.border, theme_1.uiText.border));
    console.log(`${borderLine(width, theme_1.glyphs.bottomLeft, theme_1.glyphs.bottomRight, theme_1.uiText.border)}\n`);
}
function printErrorCard(title, message, details) {
    const width = (0, text_1.terminalWidth)(92, 58);
    const innerWidth = width - 4;
    // Part-color outline: Top border in danger red (#f85149)
    console.log(borderLine(width, theme_1.glyphs.topLeft, theme_1.glyphs.topRight, theme_1.uiText.danger));
    console.log(boxedLine(`${theme_1.uiText.danger('error')} ${theme_1.uiText.subtle(theme_1.glyphs.dot)} ${theme_1.uiText.title(title.toLowerCase())}`, width, theme_1.uiText.danger, theme_1.uiText.border));
    console.log(borderLine(width, theme_1.glyphs.teeLeft, theme_1.glyphs.teeRight, theme_1.uiText.border));
    for (const line of (0, text_1.wrapText)(message.toLowerCase(), innerWidth)) {
        console.log(boxedLine(theme_1.uiText.quietValue(line), width, theme_1.uiText.border, theme_1.uiText.border));
    }
    if (details && details.length > 0) {
        console.log(boxedLine('', width, theme_1.uiText.border, theme_1.uiText.border));
        for (const d of details) {
            for (const line of (0, text_1.wrapText)(d.toLowerCase(), innerWidth)) {
                console.log(boxedLine(theme_1.uiText.muted(line), width, theme_1.uiText.border, theme_1.uiText.border));
            }
        }
    }
    console.log(`${borderLine(width, theme_1.glyphs.bottomLeft, theme_1.glyphs.bottomRight, theme_1.uiText.border)}\n`);
}
function printSkinsList(skins) {
    const width = (0, text_1.terminalWidth)(92, 58);
    // Part-color outline: Top border in focus cyan (#39c5cf)
    console.log(borderLine(width, theme_1.glyphs.topLeft, theme_1.glyphs.topRight, theme_1.uiText.focus));
    console.log(boxedLine(`${theme_1.uiText.brand('danser skins')} ${theme_1.uiText.subtle(theme_1.glyphs.dot)} ${theme_1.uiText.focus(`${skins.length} installed`)}`, width, theme_1.uiText.focus, theme_1.uiText.border));
    console.log(borderLine(width, theme_1.glyphs.teeLeft, theme_1.glyphs.teeRight, theme_1.uiText.border));
    if (skins.length === 0) {
        console.log(boxedLine(theme_1.uiText.warning('no custom skins installed yet.'), width, theme_1.uiText.border, theme_1.uiText.border));
        console.log(boxedLine(theme_1.uiText.muted('import one with: danser-record --import-skin <path-or-url>'), width, theme_1.uiText.border, theme_1.uiText.border));
    }
    else {
        for (const s of skins.sort()) {
            console.log(boxedLine(` ${theme_1.uiText.subtle(theme_1.glyphs.pointer)} ${theme_1.uiText.quietValue(s.toLowerCase())}`, width, theme_1.uiText.border, theme_1.uiText.border));
        }
    }
    console.log(`${borderLine(width, theme_1.glyphs.bottomLeft, theme_1.glyphs.bottomRight, theme_1.uiText.border)}\n`);
}
//# sourceMappingURL=card.js.map