"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripAnsi = stripAnsi;
exports.charWidth = charWidth;
exports.visibleLength = visibleLength;
exports.terminalWidth = terminalWidth;
exports.padRight = padRight;
exports.padLeft = padLeft;
exports.truncate = truncate;
exports.cleanInline = cleanInline;
exports.wrapText = wrapText;
const ANSI_PATTERN = /\x1B\[[0-9;]*[a-zA-Z]/g;
function stripAnsi(value) {
    return value.replace(ANSI_PATTERN, '');
}
function isCombiningCodePoint(codePoint) {
    return ((codePoint >= 0x0300 && codePoint <= 0x036f) ||
        (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
        (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
        (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
        (codePoint >= 0xfe20 && codePoint <= 0xfe2f));
}
function isFullWidthCodePoint(codePoint) {
    return (codePoint >= 0x1100 &&
        (codePoint <= 0x115f ||
            codePoint === 0x2329 ||
            codePoint === 0x232a ||
            (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
            (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
            (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
            (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
            (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
            (codePoint >= 0xff00 && codePoint <= 0xff60) ||
            (codePoint >= 0xffe0 && codePoint <= 0xffe6)));
}
function charWidth(char) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint === 0)
        return 0;
    if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0))
        return 0;
    if (isCombiningCodePoint(codePoint))
        return 0;
    return isFullWidthCodePoint(codePoint) ? 2 : 1;
}
function visibleLength(value) {
    return [...stripAnsi(value)].reduce((total, char) => total + charWidth(char), 0);
}
function terminalWidth(max = 92, min = 58) {
    const width = process.stdout.columns || 80;
    return Math.max(min, Math.min(max, width - 4));
}
function padRight(value, width) {
    const length = visibleLength(value);
    if (length >= width)
        return value;
    return value + ' '.repeat(width - length);
}
function padLeft(value, width) {
    const length = visibleLength(value);
    if (length >= width)
        return value;
    return ' '.repeat(width - length) + value;
}
function truncate(value, maxLength) {
    if (maxLength <= 3)
        return value.slice(0, maxLength);
    if (visibleLength(value) <= maxLength)
        return value;
    const plain = stripAnsi(value);
    let output = '';
    let width = 0;
    for (const char of plain) {
        const nextWidth = charWidth(char);
        if (width + nextWidth > maxLength - 3)
            break;
        output += char;
        width += nextWidth;
    }
    return output.trimEnd() + '...';
}
function cleanInline(value) {
    if (value === undefined || value === null || value === '')
        return '-';
    return String(value).replace(/\s+/g, ' ').trim();
}
function wrapText(value, width) {
    const words = value.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        if (visibleLength(word) > width) {
            if (current) {
                lines.push(current);
                current = '';
            }
            lines.push(truncate(word, width));
            continue;
        }
        const candidate = current ? `${current} ${word}` : word;
        if (visibleLength(candidate) > width && current) {
            lines.push(current);
            current = word;
        }
        else {
            current = candidate;
        }
    }
    if (current)
        lines.push(current);
    return lines;
}
//# sourceMappingURL=text.js.map