import * as path from 'path';
import chalk from 'chalk';
import { glyphs, palette, uiText } from './theme';
import {
  cleanInline,
  padRight,
  terminalWidth,
  truncate,
  visibleLength,
  wrapText,
} from './text';
import { ReplayMetadata, FilenameMetadata } from '../types';
import { PPResult } from '../calculator';

export type ColorFn = (s: string) => string;

export function borderLine(
  width: number,
  left: string,
  right: string,
  colorFn: ColorFn = uiText.border
): string {
  return colorFn(`${left}${glyphs.horizontal.repeat(width - 2)}${right}`);
}

export function boxedLine(
  content: string,
  width: number,
  leftColor: ColorFn = uiText.border,
  rightColor: ColorFn = uiText.border
): string {
  const left = leftColor(glyphs.vertical);
  const right = rightColor(glyphs.vertical);
  return `${left} ${padRight(content, width - 4)} ${right}`;
}

export function innerRule(label: string, width: number): string {
  const text = label ? chalk.hex(palette.accent)(` ${label.toLowerCase()} `) : '';
  const fill = glyphs.horizontal.repeat(Math.max(0, width - visibleLength(text)));
  return `${text}${uiText.border(fill)}`;
}

export function renderMeta(label: string, value?: string | number | null, labelWidth = 12): string {
  const paddedLabel = padRight(label.toLowerCase(), labelWidth);
  return `${uiText.label(paddedLabel)} ${uiText.quietValue(cleanInline(value).toLowerCase())}`;
}

export function printBanner(version: string, subtitle?: string): void {
  const width = terminalWidth(92, 58);
  const brand = `${uiText.brand('danser autofetch')} ${uiText.subtle(`v${version.toLowerCase()}`)}`;
  const title = uiText.title('replay renderer');
  const sub = subtitle
    ? uiText.subtitle(subtitle.toLowerCase())
    : uiText.subtitle('automated osu! replay video renderer & multi-mirror beatmap fetcher');

  console.log('');
  // Part-color outline: Top border and header left borders are highlighted with active border blue (#3b82f6)
  console.log(borderLine(width, glyphs.topLeft, glyphs.topRight, uiText.activeBorder));
  console.log(boxedLine(`${brand} ${uiText.subtle(glyphs.dot)} ${title}`, width, uiText.activeBorder, uiText.border));
  console.log(boxedLine(sub, width, uiText.activeBorder, uiText.border));
  console.log(borderLine(width, glyphs.bottomLeft, glyphs.bottomRight, uiText.border));
}

export function printStatus(
  tag: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  const tagColor =
    type === 'success'
      ? uiText.success
      : type === 'warning'
      ? uiText.warning
      : type === 'error'
      ? uiText.danger
      : uiText.tag;

  const tagStr = tagColor(tag.toLowerCase().padEnd(11));
  console.log(` ${uiText.subtle(glyphs.pointer)} ${tagStr} ${uiText.quietValue(message.toLowerCase())}`);
}

export function renderProgress(
  tag: string,
  downloaded: number,
  total: number,
  unit = 'mb'
): void {
  const cleanUnit = unit.toLowerCase();
  const divisor = cleanUnit === 'mb' ? 1024 * 1024 : 1024;
  const percent = total > 0 ? Math.min(100, Math.floor((downloaded * 100) / total)) : 0;
  const barLength = 20;
  const filled = Math.min(barLength, Math.floor((percent / 100) * barLength));
  const empty = barLength - filled;

  const bar = `${uiText.success(glyphs.barFilled.repeat(filled))}${uiText.subtle(glyphs.barEmpty.repeat(empty))}`;
  const downStr = (downloaded / divisor).toFixed(1);
  const totStr = total > 0 ? (total / divisor).toFixed(1) : '?';
  const tagStr = uiText.tag(tag.toLowerCase().padEnd(11));

  process.stdout.write(
    `\r ${uiText.subtle(glyphs.pointer)} ${tagStr} [${bar}] ${percent}% (${downStr} / ${totStr} ${cleanUnit})`
  );
}

export function finishProgress(): void {
  process.stdout.write('\n');
}

export function printReplayCard(
  replayPath: string,
  replay: Partial<ReplayMetadata>,
  meta?: FilenameMetadata,
  ppResult?: PPResult | null
): void {
  const width = terminalWidth(92, 58);
  const innerWidth = width - 4;
  const halfCol = Math.floor((innerWidth - 3) / 2);

  const beatmapTitle = meta?.artist && meta?.title
    ? `${meta.artist} - ${meta.title}${meta.diff ? ` [${meta.diff}]` : ''}`
    : (meta?.title ? `${meta.title}${meta.diff ? ` [${meta.diff}]` : ''}` : path.basename(replayPath));
  const cleanTitle = truncate(beatmapTitle.toLowerCase(), innerWidth - 12);
  const modeNames = ['osu! standard', 'taiko', 'catch the beat', 'osu!mania'];
  const modeStr = replay.mode !== undefined && modeNames[replay.mode] ? modeNames[replay.mode] : 'osu! standard';

  // Part-color outline: Top border in active blue (#3b82f6)
  console.log(borderLine(width, glyphs.topLeft, glyphs.topRight, uiText.activeBorder));
  console.log(
    boxedLine(
      `${uiText.accent('replay')} ${uiText.subtle(glyphs.dot)} ${uiText.title(cleanTitle)}`,
      width,
      uiText.activeBorder,
      uiText.border
    )
  );
  console.log(
    boxedLine(
      `${uiText.label('player:')} ${uiText.focus(replay.playerName?.toLowerCase() || 'unknown')}   ${uiText.subtle(glyphs.dot)}   ${uiText.label('mode:')} ${uiText.quietValue(modeStr)}`,
      width,
      uiText.activeBorder,
      uiText.border
    )
  );
  // Divider between header and data
  console.log(borderLine(width, glyphs.teeLeft, glyphs.teeRight, uiText.border));

  // Two-column layout with part-color left accent border
  function printTwoCols(leftLabel: string, leftVal: string, rightLabel: string, rightVal: string) {
    const col1 = `${uiText.label(padRight(leftLabel.toLowerCase(), 12))} ${leftVal}`;
    const col2 = `${uiText.label(padRight(rightLabel.toLowerCase(), 12))} ${rightVal}`;
    const paddedCol1 = padRight(col1, halfCol);
    const divider = chalk.hex(palette.border)(` ${glyphs.vertical} `);
    console.log(boxedLine(`${paddedCol1}${divider}${col2}`, width, uiText.border, uiText.border));
  }

  const scoreStr = replay.totalScore !== undefined ? replay.totalScore.toLocaleString() : '-';
  const modsStr = (replay.modsString || 'nm').toLowerCase();
  const comboStr = replay.maxCombo !== undefined ? `${replay.maxCombo}x` : '-';
  const statusStr = replay.fullCombo ? uiText.success('full combo (fc)') : uiText.muted('completed');

  printTwoCols('mods', uiText.accent(modsStr), 'score', uiText.warning(scoreStr));
  printTwoCols('combo', uiText.focus(comboStr), 'status', statusStr);

  const count300 = replay.count300 ?? 0;
  const count100 = replay.count100 ?? 0;
  const count50 = replay.count50 ?? 0;
  const countMiss = replay.countMiss ?? 0;

  const hits300_100 = `${uiText.value(String(count300))} ${uiText.subtle('/')} ${uiText.warning(String(count100))}`;
  const hits50_miss = `${uiText.warning(String(count50))} ${uiText.subtle('/')} ${countMiss > 0 ? uiText.danger(String(countMiss)) : uiText.muted('0')}`;
  printTwoCols('300 / 100', hits300_100, '50 / miss', hits50_miss);

  const md5Short = replay.beatmapMd5 ? truncate(replay.beatmapMd5.toLowerCase(), halfCol - 15) : '-';
  const setOrBid = meta?.beatmapId ? `#${meta.beatmapId}` : '-';
  printTwoCols('beatmap md5', uiText.muted(md5Short), 'beatmap id', uiText.focus(setOrBid));

  // Performance Points section if available
  if (ppResult) {
    console.log(borderLine(width, glyphs.teeLeft, glyphs.teeRight, uiText.border));
    console.log(
      boxedLine(
        uiText.section('performance points (2026 rework)'),
        width,
        uiText.activeBorder,
        uiText.border
      )
    );
    console.log(
      boxedLine(
        `${uiText.label(padRight('star rating', 12))} ${uiText.accent(`${ppResult.stars}★`)} ${uiText.muted(`(aim: ${ppResult.aimStars}★ ${glyphs.dot} speed: ${ppResult.speedStars}★)`)}`,
        width,
        uiText.border,
        uiText.border
      )
    );
    console.log(
      boxedLine(
        `${uiText.label(padRight('performance', 12))} ${uiText.focus(`${ppResult.totalPP} pp`)} ${uiText.muted(`(aim: ${ppResult.aimPP} ${glyphs.dot} speed: ${ppResult.speedPP} ${glyphs.dot} acc: ${ppResult.accPP})`)}`,
        width,
        uiText.border,
        uiText.border
      )
    );
    console.log(
      boxedLine(
        `${uiText.label(padRight('if 100% ss', 12))} ${uiText.warning(`${ppResult.ssPP} pp`)} ${uiText.muted(`(max combo: ${ppResult.maxCombo}x)`)}`,
        width,
        uiText.border,
        uiText.border
      )
    );
  }

  console.log(borderLine(width, glyphs.bottomLeft, glyphs.bottomRight, uiText.border));
}

export function printCompletionCard(
  videoPath: string,
  resolution: [number, number],
  fps: number,
  outputDir: string
): void {
  const width = terminalWidth(92, 58);

  // Part-color outline: Top border in success green (#3fb950)
  console.log(borderLine(width, glyphs.topLeft, glyphs.topRight, uiText.success));
  console.log(
    boxedLine(
      `${uiText.success('rendering complete')} ${uiText.subtle(glyphs.dot)} ${uiText.title('video encoded')}`,
      width,
      uiText.success,
      uiText.border
    )
  );
  console.log(
    boxedLine(
      uiText.subtitle('replay successfully rendered to mp4'),
      width,
      uiText.success,
      uiText.border
    )
  );
  console.log(borderLine(width, glyphs.teeLeft, glyphs.teeRight, uiText.border));
  console.log(
    boxedLine(
      `${uiText.label(padRight('destination', 12))} ${uiText.focus(videoPath.toLowerCase())}`,
      width,
      uiText.border,
      uiText.border
    )
  );
  console.log(
    boxedLine(
      `${uiText.label(padRight('directory', 12))} ${uiText.muted(outputDir.toLowerCase())}`,
      width,
      uiText.border,
      uiText.border
    )
  );
  console.log(
    boxedLine(
      `${uiText.label(padRight('format', 12))} ${uiText.focus(`${resolution[0]}x${resolution[1]}`)} @ ${uiText.quietValue(`${fps} fps`)} ${uiText.subtle(glyphs.dot)} ${uiText.muted('libx264')}`,
      width,
      uiText.border,
      uiText.border
    )
  );
  console.log(`${borderLine(width, glyphs.bottomLeft, glyphs.bottomRight, uiText.border)}\n`);
}

export function printErrorCard(title: string, message: string, details?: string[]): void {
  const width = terminalWidth(92, 58);
  const innerWidth = width - 4;

  // Part-color outline: Top border in danger red (#f85149)
  console.log(borderLine(width, glyphs.topLeft, glyphs.topRight, uiText.danger));
  console.log(
    boxedLine(
      `${uiText.danger('error')} ${uiText.subtle(glyphs.dot)} ${uiText.title(title.toLowerCase())}`,
      width,
      uiText.danger,
      uiText.border
    )
  );
  console.log(borderLine(width, glyphs.teeLeft, glyphs.teeRight, uiText.border));

  for (const line of wrapText(message.toLowerCase(), innerWidth)) {
    console.log(boxedLine(uiText.quietValue(line), width, uiText.border, uiText.border));
  }

  if (details && details.length > 0) {
    console.log(boxedLine('', width, uiText.border, uiText.border));
    for (const d of details) {
      for (const line of wrapText(d.toLowerCase(), innerWidth)) {
        console.log(boxedLine(uiText.muted(line), width, uiText.border, uiText.border));
      }
    }
  }

  console.log(`${borderLine(width, glyphs.bottomLeft, glyphs.bottomRight, uiText.border)}\n`);
}

export function printSkinsList(skins: string[]): void {
  const width = terminalWidth(92, 58);
  // Part-color outline: Top border in focus cyan (#39c5cf)
  console.log(borderLine(width, glyphs.topLeft, glyphs.topRight, uiText.focus));
  console.log(
    boxedLine(
      `${uiText.brand('danser skins')} ${uiText.subtle(glyphs.dot)} ${uiText.focus(`${skins.length} installed`)}`,
      width,
      uiText.focus,
      uiText.border
    )
  );
  console.log(borderLine(width, glyphs.teeLeft, glyphs.teeRight, uiText.border));

  if (skins.length === 0) {
    console.log(boxedLine(uiText.warning('no custom skins installed yet.'), width, uiText.border, uiText.border));
    console.log(boxedLine(uiText.muted('import one with: danser-record --import-skin <path-or-url>'), width, uiText.border, uiText.border));
  } else {
    for (const s of skins.sort()) {
      console.log(boxedLine(` ${uiText.subtle(glyphs.pointer)} ${uiText.quietValue(s.toLowerCase())}`, width, uiText.border, uiText.border));
    }
  }

  console.log(`${borderLine(width, glyphs.bottomLeft, glyphs.bottomRight, uiText.border)}\n`);
}
