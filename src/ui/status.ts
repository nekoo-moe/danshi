import { glyphs, uiText } from './theme';
import { terminalWidth, truncate, padRight } from './text';
import { borderLine, boxedLine } from './card';

export interface ProgressUpdate {
  title?: string;
  processName?: string;
  percent?: number;
  detail?: string;
  log?: string;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

export class StatusBox {
  public verbose: boolean;
  private title = 'your replay is being rendered, please wait...';
  private processName = 'setup';
  private percent = 0;
  private detail = '';
  private logLine = 'initializing...';
  private isRendering = false;
  private lineCount = 6;
  private lastNonTtyPercent?: number;
  private lastNonTtyProcess?: string;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  public start(initialProcess = 'setup', initialLog = 'initializing...'): void {
    this.processName = initialProcess.toLowerCase();
    this.logLine = initialLog.toLowerCase();

    if (this.verbose) {
      console.log(`› ${this.processName}: ${this.logLine}`);
    } else {
      this.render();
    }
  }

  public update(update: ProgressUpdate): void {
    if (update.title) this.title = update.title.toLowerCase();
    if (update.processName) this.processName = update.processName.toLowerCase();
    if (update.percent !== undefined) this.percent = Math.min(100, Math.max(0, Math.round(update.percent)));
    if (update.detail !== undefined) this.detail = update.detail.toLowerCase();
    if (update.log !== undefined) this.logLine = update.log.toLowerCase();

    if (this.verbose) {
      if (update.log) {
        console.log(`› ${this.processName}: ${this.logLine}`);
      }
      return;
    }

    this.render();
  }

  private render(): void {
    if (!process.stdout.isTTY) {
      const shouldLog =
        this.lastNonTtyProcess !== this.processName ||
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

    const width = terminalWidth(92, 58);
    const innerWidth = width - 4;
    const barLength = 20;
    const filled = Math.min(barLength, Math.floor((this.percent / 100) * barLength));
    const empty = barLength - filled;
    const bar = `${uiText.success(glyphs.barFilled.repeat(filled))}${uiText.subtle(glyphs.barEmpty.repeat(empty))}`;

    const processLabel = uiText.label(padRight(`${this.processName}:`, 12));
    const availableForDetail = Math.max(8, innerWidth - (12 + barLength + 10));
    const detailStr = this.detail ? ` ${uiText.muted(truncate(this.detail, availableForDetail))}` : '';
    const progressLine = `${processLabel} [${bar}] ${uiText.focus(`${this.percent}%`)}${detailStr}`;

    const maxLogWidth = innerWidth - 4;
    const cleanLog = truncate(this.logLine, maxLogWidth);
    const logLineFormatted = this.logLine
      ? ` ${uiText.subtle(glyphs.pointer)} ${uiText.quietValue(cleanLog)}`
      : '';

    // Part-color outline: Top border and title left-border in focus cyan (#39c5cf)
    const topBorder = borderLine(width, glyphs.topLeft, glyphs.topRight, uiText.focus);
    const titleLine = boxedLine(uiText.subtitle(this.title), width, uiText.focus, uiText.border);
    const divider = borderLine(width, glyphs.teeLeft, glyphs.teeRight, uiText.border);
    const progressBoxed = boxedLine(progressLine, width, uiText.border, uiText.border);
    const logBoxed = boxedLine(logLineFormatted, width, uiText.border, uiText.border);
    const bottomBorder = borderLine(width, glyphs.bottomLeft, glyphs.bottomRight, uiText.border);

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

  public finish(): void {
    if (this.verbose) return;
    if (this.isRendering && process.stdout.isTTY) {
      // Move cursor up and clear the status box lines
      process.stdout.write(`\x1B[${this.lineCount}A\x1B[0J`);
    }
    this.isRendering = false;
  }
}
