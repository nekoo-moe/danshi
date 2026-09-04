"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBox = void 0;
const theme_1 = require("./theme");
const text_1 = require("./text");
const card_1 = require("./card");
class StatusBox {
    verbose;
    title = 'your replay is being rendered, please wait...';
    processName = 'setup';
    percent = 0;
    detail = '';
    logLine = 'initializing...';
    isRendering = false;
    lineCount = 6;
    lastNonTtyPercent;
    lastNonTtyProcess;
    constructor(verbose = false) {
        this.verbose = verbose;
    }
    start(initialProcess = 'setup', initialLog = 'initializing...') {
        this.processName = initialProcess.toLowerCase();
        this.logLine = initialLog.toLowerCase();
        if (this.verbose) {
            console.log(`› ${this.processName}: ${this.logLine}`);
        }
        else {
            this.render();
        }
    }
    update(update) {
        if (update.title)
            this.title = update.title.toLowerCase();
        if (update.processName)
            this.processName = update.processName.toLowerCase();
        if (update.percent !== undefined)
            this.percent = Math.min(100, Math.max(0, Math.round(update.percent)));
        if (update.detail !== undefined)
            this.detail = update.detail.toLowerCase();
        if (update.log !== undefined)
            this.logLine = update.log.toLowerCase();
        if (this.verbose) {
            if (update.log) {
                console.log(`› ${this.processName}: ${this.logLine}`);
            }
            return;
        }
        this.render();
    }
    render() {
        if (!process.stdout.isTTY) {
            const shouldLog = this.lastNonTtyProcess !== this.processName ||
                this.lastNonTtyPercent === undefined ||
                Math.abs(this.percent - this.lastNonTtyPercent) >= 10 ||
                this.percent === 100;
            if (shouldLog) {
                this.lastNonTtyPercent = this.percent;
                this.lastNonTtyProcess = this.processName;
                const detailStr = this.detail ? ` (${this.detail})` : '';
                console.log(`› ${this.processName}: [${this.percent}%]${detailStr} ${this.logLine}`);
            }
            return;
        }
        const width = (0, text_1.terminalWidth)(92, 58);
        const innerWidth = width - 4;
        const barLength = 20;
        const filled = Math.min(barLength, Math.floor((this.percent / 100) * barLength));
        const empty = barLength - filled;
        const bar = `${theme_1.uiText.success(theme_1.glyphs.barFilled.repeat(filled))}${theme_1.uiText.subtle(theme_1.glyphs.barEmpty.repeat(empty))}`;
        const processLabel = theme_1.uiText.label((0, text_1.padRight)(`${this.processName}:`, 12));
        const availableForDetail = Math.max(8, innerWidth - (12 + barLength + 10));
        const detailStr = this.detail ? ` ${theme_1.uiText.muted((0, text_1.truncate)(this.detail, availableForDetail))}` : '';
        const progressLine = `${processLabel} [${bar}] ${theme_1.uiText.focus(`${this.percent}%`)}${detailStr}`;
        const maxLogWidth = innerWidth - 4;
        const cleanLog = (0, text_1.truncate)(this.logLine, maxLogWidth);
        const logLineFormatted = this.logLine
            ? ` ${theme_1.uiText.subtle(theme_1.glyphs.pointer)} ${theme_1.uiText.quietValue(cleanLog)}`
            : '';
        // Part-color outline: Top border and title left-border in focus cyan (#39c5cf)
        const topBorder = (0, card_1.borderLine)(width, theme_1.glyphs.topLeft, theme_1.glyphs.topRight, theme_1.uiText.focus);
        const titleLine = (0, card_1.boxedLine)(theme_1.uiText.subtitle(this.title), width, theme_1.uiText.focus, theme_1.uiText.border);
        const divider = (0, card_1.borderLine)(width, theme_1.glyphs.teeLeft, theme_1.glyphs.teeRight, theme_1.uiText.border);
        const progressBoxed = (0, card_1.boxedLine)(progressLine, width, theme_1.uiText.border, theme_1.uiText.border);
        const logBoxed = (0, card_1.boxedLine)(logLineFormatted, width, theme_1.uiText.border, theme_1.uiText.border);
        const bottomBorder = (0, card_1.borderLine)(width, theme_1.glyphs.bottomLeft, theme_1.glyphs.bottomRight, theme_1.uiText.border);
        if (this.isRendering) {
            process.stdout.write(`\x1B[${this.lineCount}A\r`);
        }
        process.stdout.write(`\x1B[2K${topBorder}\n`);
        process.stdout.write(`\x1B[2K${titleLine}\n`);
        process.stdout.write(`\x1B[2K${divider}\n`);
        process.stdout.write(`\x1B[2K${progressBoxed}\n`);
        process.stdout.write(`\x1B[2K${logBoxed}\n`);
        process.stdout.write(`\x1B[2K${bottomBorder}\n`);
        this.lineCount = 6;
        this.isRendering = true;
    }
    finish() {
        if (this.verbose)
            return;
        if (this.isRendering && process.stdout.isTTY) {
            // Move cursor up and clear the status box lines
            process.stdout.write(`\x1B[${this.lineCount}A\x1B[0J`);
        }
        this.isRendering = false;
    }
}
exports.StatusBox = StatusBox;
//# sourceMappingURL=status.js.map