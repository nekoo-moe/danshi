# 🎵 Danser AutoFetch

[![Python Version](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://python.org)
[![Danser-go](https://img.shields.io/badge/Danser--go-v0.11%2B-brightgreen.svg)](https://github.com/Wieku/danser-go)
[![osu! lazer](https://img.shields.io/badge/osu!-lazer%20compatible-ff66aa.svg)](https://osu.ppy.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

> **Automated osu! Replay Video Renderer with Multi-Mirror Beatmap Auto-Fetcher & Smart Skin Manager for Danser-go (Cross-Platform).**

---

## ✨ Features

- ⚡ **Zero-Manual Beatmap Auto-Fetching**: Automatically parses the `.osr` replay's beatmap MD5 checksum and downloads the full `.osz` package from high-speed mirrors (*Catboy / Mino, Sayobot, Chimu*) in seconds.
- 🎨 **Smart Skin Manager & Fuzzy Matching**: Automatically imports and unpacks `.osk` / `.zip` skin archives from osu! lazer's exports folder. Supports fuzzy skin name search (e.g., `-s rafis`, `-s whitecat`).
- 🎧 **Native Skin Cursor & Hitsounds**: Enforces full skin hitsounds (clap, whistle, soft, drum), skin cursor, and skin combo colors.
- ⏭️ **Auto-Skip Intro**: Automatically skips opening lead-in wait and seizure warnings to jump straight to the first circle.
- 🎬 **1080p 60FPS Rendering**: Frame-by-frame rendering with no stutter or dropped frames, exported directly into your Videos folder.
- 🌍 **Cross-Platform**: Fully tested and supported on **Windows, Linux, and macOS**.
- 🪶 **Zero External Python Dependencies**: Built entirely using the Python 3 standard library.

---

## 📥 Installation

### 1. Prerequisites
Ensure you have **[danser-go](https://github.com/Wieku/danser-go/releases)** installed on your machine.
- **Linux**: Usually placed in `~/Applications/danser` or `~/.danser`.
- **Windows**: Place `danser` anywhere (e.g., `%LOCALAPPDATA%\Programs\danser` or inside this repo).

### 2. Install Danser AutoFetch
```bash
git clone https://github.com/heiznerd/danser-autofetch.git
cd danser-autofetch
pip install -e .
```

---

## 🚀 Usage

### Basic Usage
Simply pass your exported `.osr` replay file:
```bash
danser-record /path/to/replay.osr
```

### Render with a Specific Skin (Fuzzy Search)
```bash
# Matches "Rafis 2018-03-26 HDDT (blue cursor)"
danser-record /path/to/replay.osr -s rafis

# Matches "vv_whitecat_cursor ([Garin] + Aristia + Various)"
danser-record /path/to/replay.osr -s whitecat
```

### List Available Skins
```bash
danser-record --list-skins
```

### Sync Skins from osu! exports
```bash
danser-record --sync-skins
```

---

## 🛠️ CLI Options

| Argument | Description | Default |
| :--- | :--- | :--- |
| `replay` | Path to the osu! replay file (`.osr`) | *Required* |
| `-s, --skin` | Skin name or keyword to use for rendering | Default Skin |
| `-d, --danser-dir` | Path to Danser installation folder | Auto-detected |
| `-o, --output-dir` | Directory to save rendered MP4 videos | `~/Videos/danser_records` |
| `--exports-dir` | Path to osu! lazer `exports/` folder | Auto-detected |
| `--fps` | Framerate of the output video | `60` |
| `--list-skins` | List all available skins in Danser | |
| `--sync-skins` | Synchronize skins from osu! exports | |
| `-v, --version` | Show program version | |

---

## 🇻🇳 Hướng dẫn sử dụng (Tiếng Việt)

### Cách thức hoạt động:
1. Bạn chỉ cần xuất file replay **`.osr`** từ trong **osu! lazer**.
2. Chạy lệnh: `danser-record <file.osr> -s <tên_skin>`
3. Công cụ sẽ:
   - Đọc mã MD5 của bài hát từ file replay.
   - **Tự động tải ngầm bài hát gốc (`.osz`)** từ các máy chủ nhanh nhất về thư viện Danser.
   - Tự động nạp Skin (cursor, hitsound, màu sắc).
   - Tự động bỏ qua phần intro mở đầu và render video **Full HD 1080p 60FPS**.
   - Lưu video vào thư mục `Videos/danser_records/`.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
