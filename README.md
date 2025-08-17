# Bahamut Foru### 🔗 Bahamut### 📱 Supported Content Types
- **General Forum Posts**: Supports Bahamut Forum text articles
- **Creative Sharing**: Supports creative posts with multiple images
- **Format Preservation**: Maintains original text formatting and structure
- **Smart Splitting**: Automatically splits long articles into multiple messages to comply with Discord limits Embedding
Converts Bahamut Forum article links into structured Discord embed messages, including:
- Article title and author information
- Complete article content with formatted text support (bold, italic, headers, etc.)
- Image galleries (supports multiple images)
- Video links
- Article links Bot

A Discord bot that displays Bahamut Forum articles in Discord, converting forum links into beautiful embedded messages.

## Environment Variables

```env
CLIENT_ID=""
CLIENT_SECRET=""
CLIENT_TOKEN=""
```

## Features

### � 巴哈姆特連結嵌入
將巴哈姆特論壇文章連結轉換為結構化的 Discord 嵌入訊息，包含：
- 文章標題和作者資訊
- 完整的文章內容，支援格式化文字（粗體、斜體、標題等）
- 圖片展示（支援圖集）
- 影片連結
- 文章連結

### � 支援的內容類型
- **一般論壇文章**: 支援巴哈姆特論壇的文字文章
- **創作分享**: 支援包含多張圖片的創作文章
- **格式保留**: 維持原文的文字格式和結構
- **智慧分割**: 自動將長文章分割為多個訊息以符合 Discord 限制

### ⚡ Smart Error Handling
- Automatically detects if content is too long
- Provides graceful error messages with article title and original link
- Fallback mechanisms ensure users receive useful feedback

### 🎯 How to Use
Right-click on a message containing a Bahamut Forum link and select "Create Embed" from the context menu.

> **Note**: All functions are accessible through the message context menu (application commands).

## Quick Start

Install dependencies:

```bash
bun install
```

Run the bot:

```bash
bun start
```

Or use development mode (auto-reload):

```bash
bun dev
```

## Supported Websites
- Bahamut Forum (forum.gamer.com.tw)
- Bahamut Creative Hall (home.gamer.com.tw)