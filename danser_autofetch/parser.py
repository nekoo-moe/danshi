"""
osu! replay (.osr) binary parser module.
Extracts game mode, beatmap MD5 checksum, player name, mods, score, and timestamps.
Compatible with standard osu! and osu! lazer exported replays.
"""

import struct
from typing import Dict, Any

MODS_MAP = {
    0: "NM",
    1: "NF",
    2: "EZ",
    4: "TD",
    8: "HD",
    16: "HR",
    32: "SD",
    64: "DT",
    128: "RX",
    256: "HT",
    512: "NC",
    1024: "FL",
    2048: "Auto",
    4096: "SO",
    8192: "AP",
    16384: "PF",
    32768: "4K",
    65536: "5K",
    131072: "6K",
    262144: "7K",
    524288: "8K",
    1048576: "FI",
    2097152: "Random",
    4194304: "Cinema",
    8388608: "Target",
    16777216: "9K",
    33554432: "KeyCoop",
    67108864: "1K",
    134217728: "3K",
    268435456: "2K",
    536870912: "ScoreV2",
    1073741824: "MR",
}


def parse_mods(mods_int: int) -> str:
    """Converts a bitwise mod integer into a human-readable mod string (e.g., HDDT, HR)."""
    if mods_int == 0:
        return "NM"
    active_mods = []
    # If Nightcore is active, suppress DoubleTime display
    if mods_int & 512:
        mods_int &= ~64
    # If Perfect is active, suppress SuddenDeath display
    if mods_int & 16384:
        mods_int &= ~32

    for bit, name in MODS_MAP.items():
        if bit != 0 and (mods_int & bit):
            active_mods.append(name)
    return "+".join(active_mods) if active_mods else "NM"


def parse_replay(file_path: str) -> Dict[str, Any]:
    """
    Parses an osu! replay file (.osr) and returns a dictionary of extracted metadata.
    """
    with open(file_path, "rb") as f:
        mode = struct.unpack("B", f.read(1))[0]
        version = struct.unpack("<I", f.read(4))[0]

        def read_osu_string() -> str:
            indicator = f.read(1)
            if not indicator or indicator[0] != 0x0B:
                return ""
            length = 0
            shift = 0
            while True:
                byte_b = f.read(1)
                if not byte_b:
                    break
                byte = byte_b[0]
                length |= (byte & 0x7F) << shift
                if not (byte & 0x80):
                    break
                shift += 7
            if length <= 0:
                return ""
            raw_bytes = f.read(length)
            return raw_bytes.decode("utf-8", errors="ignore")

        beatmap_md5 = read_osu_string()
        player_name = read_osu_string()
        replay_md5 = read_osu_string()

        count_300 = struct.unpack("<H", f.read(2))[0]
        count_100 = struct.unpack("<H", f.read(2))[0]
        count_50 = struct.unpack("<H", f.read(2))[0]
        count_geki = struct.unpack("<H", f.read(2))[0]
        count_katu = struct.unpack("<H", f.read(2))[0]
        count_miss = struct.unpack("<H", f.read(2))[0]

        total_score = struct.unpack("<I", f.read(4))[0]
        max_combo = struct.unpack("<H", f.read(2))[0]
        full_combo = struct.unpack("B", f.read(1))[0] == 1
        mods_int = struct.unpack("<I", f.read(4))[0]

        return {
            "mode": mode,
            "game_version": version,
            "beatmap_md5": beatmap_md5,
            "player_name": player_name,
            "replay_md5": replay_md5,
            "count_300": count_300,
            "count_100": count_100,
            "count_50": count_50,
            "count_geki": count_geki,
            "count_katu": count_katu,
            "count_miss": count_miss,
            "total_score": total_score,
            "max_combo": max_combo,
            "full_combo": full_combo,
            "mods_int": mods_int,
            "mods_string": parse_mods(mods_int),
        }
