"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.glyphs = exports.uiText = exports.palette = void 0;
const chalk_1 = __importDefault(require("chalk"));
exports.palette = {
    primary: '#58a6ff',
    accent: '#db61a2',
    cyan: '#39c5cf',
    green: '#3fb950',
    yellow: '#d29922',
    red: '#f85149',
    text: '#f0f6fc',
    muted: '#8b949e',
    subtle: '#6e7681',
    border: '#30363d',
    borderActive: '#3b82f6',
};
exports.uiText = {
    brand: chalk_1.default.hex(exports.palette.primary).bold,
    title: chalk_1.default.hex(exports.palette.text).bold,
    subtitle: chalk_1.default.hex(exports.palette.muted),
    section: chalk_1.default.hex(exports.palette.accent).bold,
    label: chalk_1.default.hex(exports.palette.primary).bold,
    value: chalk_1.default.white,
    quietValue: chalk_1.default.hex(exports.palette.text),
    muted: chalk_1.default.hex(exports.palette.muted),
    subtle: chalk_1.default.hex(exports.palette.subtle),
    success: chalk_1.default.hex(exports.palette.green),
    warning: chalk_1.default.hex(exports.palette.yellow),
    danger: chalk_1.default.hex(exports.palette.red),
    border: chalk_1.default.hex(exports.palette.border),
    activeBorder: chalk_1.default.hex(exports.palette.borderActive),
    accent: chalk_1.default.hex(exports.palette.accent),
    focus: chalk_1.default.hex(exports.palette.cyan).bold,
    tag: chalk_1.default.hex(exports.palette.cyan),
};
exports.glyphs = {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    teeLeft: '├',
    teeRight: '┤',
    cross: '┼',
    dot: '·',
    pointer: '›',
    star: '★',
    arrow: '→',
    barFilled: '█',
    barEmpty: '░',
};
//# sourceMappingURL=theme.js.map