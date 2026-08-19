# Danser AutoFetch

[![NPM Version](https://img.shields.io/npm/v/danser-autofetch.svg?style=flat&color=CB3837)](https://www.npmjs.com/package/danser-autofetch)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6.svg)](https://www.typescriptlang.org)
[![Danser-go](https://img.shields.io/badge/Danser--go-v0.11%2B-brightgreen.svg)](https://github.com/Wieku/danser-go)
[![osu! lazer](https://img.shields.io/badge/osu!-lazer%20compatible-ff66aa.svg)](https://osu.ppy.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

Danser AutoFetch is a cross-platform CLI automation tool written in **TypeScript / Node.js** that bridges **osu! lazer** and **[danser-go](https://github.com/Wieku/danser-go)**. It automatically parses exported replay files (`.osr`), resolves and downloads missing beatmaps from high-speed mirror networks, manages custom skins, and renders 1080p 60FPS videos with zero manual effort.

---

> **Note on Compatibility / Lưu ý tương thích:**
>
> **EN:** This tool is designed and optimized specifically for **osu! lazer**. If you are using **osu! stable**, please consider using the upstream **[danser-go](https://github.com/Wieku/danser-go)** project directly to support the original author.
>
> **VI:** Hoạt động tốt nhất khi sử dụng phiên bản **osu!lazer**, nếu bạn sử dụng bản **osu! stable**, hãy sử dụng trực tiếp **[danser-go](https://github.com/Wieku/danser-go)** để ủng hộ dự án chính.

---

## Overview & Architecture

In **osu! lazer**, beatmaps, audio files, and background images are stored as fragmented, content-addressed hash blobs managed inside a Realm database (`client.realm`) rather than human-readable folders. Because Danser-go was originally architected for osu! stable's traditional folder hierarchy, rendering a replay exported from osu! lazer previously required manually downloading `.osz` files or extracting beatmap archives.

Danser AutoFetch solves this by implementing an automated resolution pipeline:
1. **Binary Replay Stream Parsing:** Uses Buffer & ULEB128 stream decoding to extract the beatmap MD5 checksum, player name, score, accuracy, and active mods.
2. **Multi-Mirror Auto-Fetcher:** Queries community mirror APIs (*Catboy / Mino, Sayobot, Chimu*) to resolve the Beatmap Set ID and automatically download missing `.osz` packages in the background. If MD5 lookup fails due to unranked/updated diffs, it falls back to creator- and difficulty-aware text searches.
3. **On-Demand Skin Management:** Imports local skin archives (`.osk`, `.zip`), directories, or direct URLs on demand without scanning or polluting the host environment.
4. **Automated Danser Execution:** Injects native skin cursors, skin hitsounds, skips lead-in delays, resolves FFmpeg binaries, and encodes 1080p 60FPS video output.

---

## Strengths & Advantages (Điểm mạnh)

- **One-Step CLI Workflow:** Transforms any exported `.osr` file into a high-definition MP4 video with a single command.
- **Run Instantly via NPX:** No permanent installation required—can be executed on-the-fly using `npx danser-autofetch <replay.osr>`.
- **Creator-Aware Smart Fallback:** Intelligently matches beatmap sets even if the local replay MD5 hash differs from mirror versions.
- **Zero-Default Skin Footprint:** Does not clutter system directories by default. Skins are loaded purely on-demand via local path, folder, URL, or keyword.
- **True Skin Asset Fidelity:** Automatically forces skin hitsounds (`IgnoreBeatmapSamples`), skin cursors (`UseSkinCursor`), long cursor trails, and skin combo colors.
- **Lead-In Optimization:** Automatically bypasses opening intro pauses and seizure warnings to jump straight to active gameplay.
- **Cross-Platform Compatibility:** Native support and path auto-detection for Linux, Windows, and macOS.

---

## Limitations & Technical Considerations (Điểm yếu & Giới hạn)

- **Network Dependency for New Maps:** Auto-fetching requires an active internet connection the first time an uncached beatmap is rendered.
- **Unranked / Unsubmitted Map Limitations:** If a replay was played on a completely private local map that does not exist on public osu! mirrors, the `.osz` cannot be fetched automatically and must be placed manually in Danser's `Songs` folder.
- **Gamemode Scope:** Danser-go is specifically designed for standard osu! gameplay (`Mode: 0`). Replays for Taiko, Catch the Beat, or osu!mania are not supported by the upstream renderer.
- **Hardware-Dependent Encoding Speed:** Video rendering speed is determined by your CPU/GPU hardware specifications.

---

## Installation

### 1. Prerequisites
Ensure you have **[danser-go](https://github.com/Wieku/danser-go/releases)** installed:
- **Linux:** `~/Applications/danser` or `~/.danser`.
- **Windows:** Any folder (e.g., `%LOCALAPPDATA%\Programs\danser` or next to this repository).
- **macOS:** `~/Applications/danser` or `~/Library/Application Support/danser`.

### 2. Install via NPM (Recommended)
```bash
npm install -g danser-autofetch
```

Or run directly without installing using **NPX**:
```bash
npx danser-autofetch /path/to/replay.osr
```

### 3. Build from Source
```bash
git clone https://github.com/heiznerd/danser-autofetch.git
cd danser-autofetch
npm install
npm run build
npm link
```

---

## Usage Guide

### Basic Rendering
Pass the path to any exported `.osr` replay file:
```bash
danser-record /path/to/replay.osr
```

### Rendering with Custom Skins
You can supply a skin name, a local `.osk`/`.zip` file path, a skin folder, or a download URL:

```bash
# Using a keyword for an installed skin:
danser-record /path/to/replay.osr -s rafis
danser-record /path/to/replay.osr -s whitecat

# Using a local .osk file path (Linux / macOS):
danser-record /path/to/replay.osr -s "/home/user/Downloads/MySkin.osk"

# Using a local .osk file path (Windows):
danser-record replay.osr -s "C:\Users\Name\Downloads\MySkin.osk"

# Using a direct skin download URL:
danser-record /path/to/replay.osr -s "https://example.com/skins/CustomSkin.osk"
```

### Managing Skins
```bash
# List all currently installed skins:
danser-record --list-skins

# Permanently import a skin without rendering:
danser-record --import-skin "/path/to/skin.osk"

# Manually synchronize skins from osu! exports and Downloads folders:
danser-record --sync-skins
```

---

## Command-Line Options Reference

| Option | Description | Default |
| :--- | :--- | :--- |
| `replay` | Path to the target osu! replay file (`.osr`) | *Required for rendering* |
| `-s, --skin` | Skin keyword, local archive path (`.osk`/`.zip`), folder path, or download URL | Default Skin |
| `--import-skin` | Import and unpack a skin into Danser without starting a render | None |
| `-d, --danser-dir` | Custom path to Danser installation directory | Auto-detected |
| `-o, --output-dir` | Destination directory for exported MP4 videos | `~/Videos/danser_records` |
| `--exports-dir` | Custom path to osu! lazer `exports/` folder | Auto-detected |
| `--fps` | Framerate of the output video | `60` |
| `--list-skins` | Print all installed skins and exit | Disabled |
| `--sync-skins` | Manually scan and import skins from system folders | Disabled |
| `-v, --version` | Display program version | |

---

## Publishing to NPM

To publish a new release to npmjs.com:
```bash
# 1. Login to your NPM account
npm login

# 2. Build and publish
npm run build
npm publish
```

---

## Hướng dẫn chi tiết (Tiếng Việt)

### Tổng quan
Trong **osu! lazer**, toàn bộ dữ liệu bài hát và nhạc nền được mã hóa dạng hash bên trong cơ sở dữ liệu `client.realm`. Do đó, khi xuất file replay `.osr`, người dùng không thể đưa trực tiếp vào Danser-go như bản osu! stable ngày trước.

**Danser AutoFetch** tự động hóa toàn bộ quy trình này:
1. **Phân tích replay `.osr`**: Trích xuất mã MD5 bài hát, tên người chơi, mods và điểm số.
2. **Tự động tải nhạc ngầm**: Tìm kiếm và tải file `.osz` gốc từ các mirror server (*Catboy, Sayobot, Chimu*) về Danser trong vài giây.
3. **Cơ chế nạp Skin linh hoạt**: Nhận diện đường dẫn file `.osk`, thư mục hoặc link tải trực tiếp mà không cần cài đặt thủ công.
4. **Xuất video chuẩn 1080p 60FPS**: Tự động áp dụng Hitsound của Skin, con trỏ chuột, bỏ qua intro và lưu video vào thư mục `Videos/danser_records`.

---

## License & Credits

- Core rendering engine powered by **[danser-go](https://github.com/Wieku/danser-go)** by **Wieku**.
- Beatmap resolution powered by community mirrors: **Catboy / Mino**, **Sayobot**, and **Chimu**.
- Licensed under the **[MIT License](LICENSE)**.

---

## ⚡ 2026 Performance Points & Star Rating Engine

Danser AutoFetch integrates **`rosu-pp`** (WebAssembly), which implements the latest official **[osu! July 2026 Performance Points & Star Rating Rework](https://osu.ppy.sh/home/news/2026-07-03-performance-points-star-rating-updates)**:
- **Updated Star Rating (SR):** Modern Aim, Speed, and Flashlight strain calculations.
- **Accurate PP Breakdown:** Full component metrics for Play PP (*Aim, Speed, Accuracy, Flashlight*) and theoretical 100% SS Max PP.
- **Up-to-Date Algorithms:** Includes modern slider tracking, miss penalties, and length bonus curves.
