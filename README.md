# 🔗 Bahamut Forum Embed Bot

A Discord bot that displays Bahamut Forum articles in Discord, converting forum links into beautiful embedded messages.

## Environment Variables

```env
CLIENT_ID="""
CLIENT_TOKEN=""
URL=""
PROXY_APIKEY=""
```

## Features

### 🔗 Bahamut Link Embedding
Converts Bahamut Forum article links into structured Discord embed messages, including:
- Article title and author information
- Complete article content with formatted text support (bold, italic, headers, etc.)
- Image galleries (supports multiple images)
- Video links
- Article links

### 📱 Supported Content Types
- **General Forum Posts**: Supports Bahamut Forum text articles
- **Creative Sharing**: Supports creative posts with multiple images
- **Format Preservation**: Maintains original text formatting and structure
- **Smart Splitting**: Automatically splits long articles into multiple messages to comply with Discord limits

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