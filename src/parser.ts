/**
 * osu! replay (.osr) binary parser in TypeScript.
 */

import * as fs from 'fs';
import { ReplayMetadata } from './types';

export const MODS_MAP: Record<number, string> = {
  0: 'NM',
  1: 'NF',
  2: 'EZ',
  4: 'TD',
  8: 'HD',
  16: 'HR',
  32: 'SD',
  64: 'DT',
  128: 'RX',
  256: 'HT',
  512: 'NC',
  1024: 'FL',
  2048: 'Auto',
  4096: 'SO',
  8192: 'AP',
  16384: 'PF',
  32768: '4K',
  65536: '5K',
  131072: '6K',
  262144: '7K',
  524288: '8K',
  1048576: 'FI',
  2097152: 'Random',
  4194304: 'Cinema',
  8388608: 'Target',
  16777216: '9K',
  33554432: 'KeyCoop',
  67108864: '1K',
  134217728: '3K',
  268435456: '2K',
  536870912: 'ScoreV2',
  1073741824: 'MR',
};

export function parseMods(modsInt: number): string {
  if (modsInt === 0) return 'NM';

  let remainingMods = modsInt;
  // If Nightcore is present, ignore DoubleTime bit in string
  if (remainingMods & 512) {
    remainingMods &= ~64;
  }
  // If Perfect is present, ignore SuddenDeath bit in string
  if (remainingMods & 16384) {
    remainingMods &= ~32;
  }

  const activeMods: string[] = [];
  for (const [bitStr, name] of Object.entries(MODS_MAP)) {
    const bit = Number(bitStr);
    if (bit !== 0 && (remainingMods & bit) !== 0) {
      activeMods.push(name);
    }
  }

  return activeMods.length > 0 ? activeMods.join('+') : 'NM';
}

export function parseReplay(filePath: string): ReplayMetadata {
  const buffer = fs.readFileSync(filePath);
  let offset = 0;

  const mode = buffer.readUInt8(offset);
  offset += 1;

  const gameVersion = buffer.readUInt32LE(offset);
  offset += 4;

  function readOsuString(): string {
    if (offset >= buffer.length) return '';
    const indicator = buffer.readUInt8(offset);
    offset += 1;

    if (indicator !== 0x0b) {
      return '';
    }

    let length = 0;
    let shift = 0;
    while (offset < buffer.length) {
      const byte = buffer.readUInt8(offset);
      offset += 1;
      length |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        break;
      }
      shift += 7;
    }

    if (length <= 0 || offset + length > buffer.length) {
      return '';
    }

    const str = buffer.toString('utf-8', offset, offset + length);
    offset += length;
    return str;
  }

  const beatmapMd5 = readOsuString();
  const playerName = readOsuString();
  const replayMd5 = readOsuString();

  const count300 = buffer.readUInt16LE(offset);
  offset += 2;
  const count100 = buffer.readUInt16LE(offset);
  offset += 2;
  const count50 = buffer.readUInt16LE(offset);
  offset += 2;
  const countGeki = buffer.readUInt16LE(offset);
  offset += 2;
  const countKatu = buffer.readUInt16LE(offset);
  offset += 2;
  const countMiss = buffer.readUInt16LE(offset);
  offset += 2;

  const totalScore = buffer.readUInt32LE(offset);
  offset += 4;
  const maxCombo = buffer.readUInt16LE(offset);
  offset += 2;
  const fullCombo = buffer.readUInt8(offset) === 1;
  offset += 1;
  const modsInt = buffer.readUInt32LE(offset);
  offset += 4;

  return {
    mode,
    gameVersion,
    beatmapMd5,
    playerName,
    replayMd5,
    count300,
    count100,
    count50,
    countGeki,
    countKatu,
    countMiss,
    totalScore,
    maxCombo,
    fullCombo,
    modsInt,
    modsString: parseMods(modsInt),
  };
}
