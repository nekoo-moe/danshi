# danshi

[![NPM Version](https://img.shields.io/npm/v/danshi.svg?style=flat&color=CB3837)](https://www.npmjs.com/package/danshi)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6.svg)](https://www.typescriptlang.org)
[![Danser-go](https://img.shields.io/badge/Danser--go-v0.11%2B-brightgreen.svg)](https://github.com/Wieku/danser-go)
[![osu! lazer](https://img.shields.io/badge/osu!-lazer%20compatible-ff66aa.svg)](https://osu.ppy.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

danshi is a cross-platform CLI automation tool written in **TypeScript / Node.js** that bridges **osu! lazer** and **[danser-go](https://github.com/Wieku/danser-go)**. It automatically discovers exported replay files (`.osr`), resolves and downloads missing beatmaps from high-speed mirror networks, manages custom skins, and renders high-definition gameplay videos with a modern, interactive terminal interface and zero manual effort.

---

> **Note on Compatibility**
>
> **EN:** This tool is designed and optimized specifically for **osu! lazer**. If you are using **osu! stable**, please consider using the upstream **[danser-go](https://github.com/Wieku/danser-go)** project directly to support the original author.

---

## Overview & Architecture

In **osu! lazer**, beatmaps, audio files, and background images are stored as fragmented, content-addressed hash blobs managed inside a Realm database (`client.realm`) rather than human-readable folders. Because Danser-go was originally architected for osu! stable's traditional folder hierarchy, rendering a replay exported from osu! lazer previously required manually downloading `.osz` files or extracting beatmap archives.

danshi automates this entire pipeline:
1. **Auto-Discovery & Binary Stream Parsing:** Automatically scans your Downloads, Documents, Desktop, and osu! exports directory for the latest `.osr` replay if no file is provided. Uses Buffer & ULEB128 stream decoding to extract the beatmap MD5 checksum, player name, score, accuracy, judgements, and active mods.
2. **Local Cache Fast-Path & Multi-Mirror Fetcher:** Immediately checks your local Danser `Songs` folder by MD5 before hitting the network. If missing, it queries community mirror networks (*Sayobot, Nerinyan, Mino / Catboy, Beatconnect, Chimu, osu.direct*) with automatic fallback to difficulty/creator matching.
3. **Integrated 2026 Performance Points Engine:** Calculates Star Rating and modern Performance Points (Aim, Speed, Accuracy, 100% SS Max PP) using `rosu-pp-js` (July 2026 rework) before rendering begins.
4. **On-Demand Skin Management:** Imports local skin archives (`.osk`, `.zip`), directories, or direct URLs on demand without cluttering the host environment.
5. **Modern Terminal Interface & Live Encoding:** Features minimalist ASCII cards (brand banner, replay summary, completion card, diagnostic error card) and a dynamic real-time `StatusBox` that tracks encoding progress, FPS, and ETA via piped stdout/stderr.

---

## Strengths & Advantages

- **Interactive Modern Terminal UX:** Clean, minimalist ASCII cards and live interactive status box with progress bar, ETA, and FPS indicators.
- **Zero-Setup First Boot:** If `danser-go` is not found on your system, it automatically downloads and configures the latest release directly from GitHub.
- **Smart Replay Auto-Discovery:** Run `danshi` (or alias `danser-record`) without arguments to automatically detect and render your most recently exported replay.
- **Fast-Path Local Cache Check:** Verifies if the beatmap is already present locally via MD5 hash before making any network requests.
- **Multi-Resolution Video Output:** Flexible `-r, --resolution` flag supporting `480p`, `720p`, `1080p`, `1440p` (2K), `4K`, or custom dimensions (e.g. `1920x1080`).
- **July 2026 PP Breakdown:** Instantly previews Star Rating (Aim/Speed) and live PP (Aim, Speed, Acc, 100% SS) on the terminal replay card.
- **Resilient Multi-Mirror Downloads:** Fallback chain across Sayobot, Nerinyan, Mino, Beatconnect, Chimu, and osu.direct with progress counters.
- **Zero-Default Skin Footprint:** Skins are loaded purely on-demand via local path, folder, URL, or keyword without polluting system directories.
- **True Skin Asset Fidelity:** Automatically enforces native skin hitsounds (`IgnoreBeatmapSamples`), skin cursors (`UseSkinCursor`), long cursor trails, and combo colors.
- **Lead-In Optimization:** Bypasses opening intro pauses and seizure warnings to jump straight to active gameplay.
- **Diagnostics & Error Reporting:** Captures tail process logs on failure to provide clear troubleshooting advice.

---

## Limitations & Technical Considerations

- **Network Dependency for New Maps:** Auto-fetching requires an active internet connection the first time an uncached beatmap is rendered.
- **Unranked / Unsubmitted Map Limitations:** If a replay was played on a completely private local map that does not exist on public osu! mirrors, the `.osz` cannot be fetched automatically and must be placed manually in Danser's `Songs` folder.
- **Gamemode Scope:** Danser-go is specifically designed for standard osu! gameplay (`Mode: 0`). Replays for Taiko, Catch the Beat, or osu!mania are not supported by the upstream renderer.
- **Hardware-Dependent Encoding Speed:** Video rendering speed is determined by your CPU/GPU hardware specifications.

---

## Installation

### 1. Automated First-Boot (Recommended)
You do **not** need to manually install Danser-go! When you run `danshi` for the first time, it automatically detects your OS and architecture, downloads the latest release from GitHub, unpacks it, and configures default settings.

If you prefer to use an existing Danser-go installation, place it in standard locations or specify `-d, --danser-dir`:
- **Linux:** `~/Applications/danser` or `~/.danser`
- **Windows:** `%LOCALAPPDATA%\Programs\danser` or Danser folder next to the project
- **macOS:** `~/Applications/danser` or `~/Library/Application Support/danser`

### 2. Install via NPM
```bash
npm install -g danshi
```

Or run directly without installing using **NPX**:
```bash
npx danshi
```

### 3. Build from Source
```bash
git clone https://github.com/nekoo-moe/danshi.git
cd danshi
npm install
npm run build
npm link
```

---

## Usage Guide

> **Note on Command Aliases**: Both `danshi` and `danser-record` are available as executable commands.

### 1. Basic Rendering
Pass the path to any exported `.osr` replay file, or omit it to automatically detect the newest replay from your system:
```bash
# Auto-pick the newest replay from Downloads, Documents, Desktop, or osu! exports:
danshi

# Or specify a specific replay file:
danshi /path/to/replay.osr
```

### 2. Custom Resolution & Framerate
Render in various preset resolutions (`480p`, `720p`, `1080p`, `1440p` / 2K, `4K`) or custom dimensions:
```bash
# Render at 1440p (2K) 60 FPS:
danshi replay.osr -r 1440p

# Render at 4K:
danshi replay.osr -r 4k

# Render at 720p 60 FPS:
danshi replay.osr -r 720p --fps 60

# Custom resolution (Width x Height):
danshi replay.osr -r 2560x1440
```

### 3. Rendering with Custom Skins
Supply a skin name/keyword, a local `.osk`/`.zip` file path, a skin folder, or a download URL:
```bash
# Using a keyword for an installed skin:
danshi replay.osr -s rafis
danshi replay.osr -s whitecat

# Using a local .osk file path (Linux / macOS):
danshi replay.osr -s "/home/user/Downloads/MySkin.osk"

# Using a local .osk file path (Windows):
danshi replay.osr -s "C:\Users\Name\Downloads\MySkin.osk"

# Using a direct skin download URL:
danshi replay.osr -s "https://example.com/skins/CustomSkin.osk"
```

### 4. Managing Skins
```bash
# List all currently installed skins in Danser:
danshi --list-skins

# Permanently import a skin without rendering:
danshi --import-skin "/path/to/skin.osk"

# Manually synchronize skins from osu! exports and Downloads folders:
danshi --sync-skins
```

### 5. Verbose Diagnostic Mode
If you need to view raw `danser-go` stdout and stderr logs instead of the interactive status box:
```bash
danshi replay.osr --verbose
```

---

## Command-Line Options Reference

| Option | Description | Default |
| :--- | :--- | :--- |
| `[replay]` | Path to target osu! replay file (`.osr`). If omitted, auto-picks the newest replay found in Downloads, Documents, Desktop, or osu! exports | *Auto-detected* |
| `-r, --resolution <res>` | Output resolution: `480p`, `720p`, `1080p`, `1440p` (2k), `4k`, or custom `WxH` (e.g. `1920x1080`) | `1080p` |
| `--fps <fps>` | Output video framerate (e.g., `30`, `60`, `120`) | `60` |
| `-s, --skin <skin>` | Skin keyword, local archive (`.osk`/`.zip`), folder path, or download URL | Default Skin |
| `--import-skin <pathOrUrl>` | Import and unpack a skin into Danser without starting a render | None |
| `-d, --danser-dir <path>` | Custom path to Danser installation directory | Auto-detected |
| `-o, --output-dir <path>` | Destination directory for exported MP4 videos | `~/Videos/danser_records` |
| `--exports-dir <path>` | Custom path to osu! lazer `exports/` folder | Auto-detected |
| `--list-skins` | Print all installed skins and exit | Disabled |
| `--sync-skins` | Manually scan and import skins from system folders | Disabled |
| `--verbose` | Show detailed log stream instead of compact status box | Disabled |
| `-v, --version` | Display program version | |
| `-h, --help` | Display CLI help menu | |

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

## 2026 Performance Points & Star Rating Engine

danshi integrates **`rosu-pp-js`** (WebAssembly), which implements the latest official **[osu! July 2026 Performance Points & Star Rating Rework](https://osu.ppy.sh/home/news/2026-07-03-performance-points-star-rating-updates)**:
- **Updated Star Rating (SR):** Modern Aim, Speed, and Flashlight strain calculations.
- **Accurate PP Breakdown:** Full component metrics for Play PP (*Aim, Speed, Accuracy, Flashlight*) and theoretical 100% SS Max PP.
- **Direct `.osu` Metadata Extraction:** Reads metadata directly from `.osu` files to enrich titles, mappers, and difficulties even with non-standard replay names.
- **Up-to-Date Algorithms:** Modern slider tracking, miss penalties, and length bonus curves.
