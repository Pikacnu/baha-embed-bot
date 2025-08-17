import {
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';

import { LineType } from './baha-type';
import type { Content, Line, TextStyle } from './baha-type';

type GenerateOptions = {
  // artwork-level images (used for Artwork posts)
  artworkImages?: string[];
  // limit images per gallery to avoid huge payloads
  galleryLimit?: number;
};

function applyTextStyle(text: string, style?: TextStyle): string {
  if (!style) return text;
  let result = text;

  if (style.bold) result = `**${result}**`;
  if (style.italic) result = `*${result}*`;
  if (style.underline) result = `__${result}__`;
  if (style.strikethrough) result = `~~${result}~~`;

  return result;
}

function applyFontSize(text: string, fontSize?: 'h1' | 'h2' | 'h3'): string {
  if (!fontSize) return text;
  switch (fontSize) {
    case 'h1':
      return `# ${text}`;
    case 'h2':
      return `## ${text}`;
    case 'h3':
      return `### ${text}`;
  }
}

function flattenLines(lines: Line | Line[]): Line[] {
  if (Array.isArray(lines)) return lines.flatMap(flattenLines as any) as Line[];
  return [lines];
}

function completelyFlattenLines(lines: (Line | Line[])[]): Line[] {
  // 完全拆解所有層級的 Array，遞迴到最深層
  const result: Line[] = [];

  function flattenRecursively(item: Line | Line[]): void {
    if (Array.isArray(item)) {
      // 如果是 Array，遞迴處理每個元素
      for (const element of item) {
        flattenRecursively(element);
      }
    } else {
      // 如果是基本 Line 類型，直接加入結果
      result.push(item);
    }
  }

  // 處理輸入的每個項目
  for (const line of lines) {
    flattenRecursively(line);
  }

  return result;
}

function processLinesWithInnerMerging(lines: (Line | Line[])[]): Line[] {
  // 從最內層開始合併，然後再處理外層
  const mergeTextLines = (lineGroup: Line[]): Line[] => {
    const merged: Line[] = [];
    let currentTextBlock: any | null = null;

    for (const line of lineGroup) {
      // 檢查是否為基本 line 類型（非 Array）
      if (!Array.isArray(line) && (line as any).type === LineType.Text) {
        const textLine = line as any;

        // 檢查是否可以與前一個文字塊合併
        if (
          currentTextBlock &&
          !textLine.style?.isList &&
          JSON.stringify(currentTextBlock.style) ===
            JSON.stringify(textLine.style)
        ) {
          // 合併相同樣式的文字行
          currentTextBlock.content += textLine.content;
        } else {
          // 推送之前的文字塊
          if (currentTextBlock) {
            merged.push(currentTextBlock);
          }
          // 開始新的文字塊
          currentTextBlock = {
            type: LineType.Text,
            content: textLine.content,
            style: textLine.style,
          };
        }
      } else {
        // 非文字行，推送之前的文字塊並加入當前行
        if (currentTextBlock) {
          merged.push(currentTextBlock);
          currentTextBlock = null;
        }
        merged.push(line);
      }
    }

    // 推送最後的文字塊
    if (currentTextBlock) {
      merged.push(currentTextBlock);
    }

    return merged;
  };

  const processRecursively = (items: (Line | Line[])[]): Line[] => {
    const flattened: Line[] = [];

    for (const item of items) {
      if (Array.isArray(item)) {
        // 遞迴處理內層 Array，先合併內層
        const innerProcessed = processRecursively(item);
        const innerMerged = mergeTextLines(innerProcessed);
        flattened.push(...innerMerged);
      } else {
        flattened.push(item);
      }
    }

    return flattened;
  };

  // 首先處理所有內層
  const innerProcessed = processRecursively(lines);
  // 然後合併最外層
  return mergeTextLines(innerProcessed);
}

/**
 * Build component builders array from contents.
 * - 對於 artworkImages 會先加入一個 MediaGallery
 * - 合併連續的文字行為單一 TextDisplay（以換行符號分隔）
 * - 依據 style 加入 Discord Markdown
 */
export function generateComponents(
  contents: Content[],
  options: GenerateOptions = {},
): (MediaGalleryBuilder | TextDisplayBuilder | SeparatorBuilder)[] {
  const galleryLimit = options.galleryLimit ?? 10;

  return contents.flatMap((content) => {
    const components: (
      | MediaGalleryBuilder
      | TextDisplayBuilder
      | SeparatorBuilder
    )[] = [];

    // If overall artwork images provided, add them first (Artwork example)
    if (options.artworkImages && options.artworkImages.length > 0) {
      const gallery = new MediaGalleryBuilder();
      options.artworkImages.slice(0, galleryLimit).forEach((url) => {
        gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
      });
      components.push(gallery);
    }

    // Title as styled text display
    const titleText = `# ${content.header.title}`;
    const titleTrim = titleText.trim();
    if (titleTrim.length > 3) {
      components.push(new TextDisplayBuilder().setContent(titleTrim));
    }

    // small separator between header and body
    components.push(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true),
    );

    // Process body lines: 完全拆解所有層級的 Array
    const rawLinesArray = content.body.lines as unknown as (Line | Line[])[];
    const processedLines = processLinesWithInnerMerging(rawLinesArray);
    const mergedTextBlocks: { text: string; style?: TextStyle }[] = [];

    function pushText(
      text: string,
      style?: TextStyle,
      forceInlineMerge: boolean = false,
    ) {
      const prev = mergedTextBlocks[mergedTextBlocks.length - 1];

      // 新增強制合併邏輯
      if (forceInlineMerge && prev) {
        // 強制合併元素，不換行直接連接
        prev.text += text;
        return;
      }

      // 檢查是否可以合併
      const canMerge =
        prev &&
        // 需要相同樣式或符合特定條件
        (JSON.stringify(prev.style) === JSON.stringify(style) ||
          // 或者符合特定合併條件（都無特殊樣式）
          (prev.style?.fontSize === style?.fontSize &&
            !prev.style?.fontSize &&
            !style?.fontSize &&
            !prev.style?.isList &&
            !style?.isList));

      if (canMerge) {
        // 換行合併
        prev.text += '\n' + text;
      } else {
        // 不能合併，創建新的文字塊
        mergedTextBlocks.push({
          text: applyFontSize(text, style?.fontSize),
          style,
        });
      }
    }

    function flushTextBlocks() {
      if (mergedTextBlocks.length === 0) return;

      // Merge all text blocks into fewer components
      let currentBlock = '';

      for (const blk of mergedTextBlocks) {
        if (!blk) continue;

        const text = blk.text.trim();
        if (text.length === 0) continue;

        // If adding this would make the block too long, flush current block first
        if (
          currentBlock.length > 0 &&
          currentBlock.length + text.length > 1500
        ) {
          components.push(new TextDisplayBuilder().setContent(currentBlock));
          currentBlock = text;
        } else {
          currentBlock += (currentBlock.length > 0 ? '\n' : '') + text;
        }
      }

      // Add the final block
      if (currentBlock.length > 0) {
        // 確保最終塊不超過 4000 字元限制
        if (currentBlock.length > 1500) {
          // 如果超過限制，分割成多個塊
          const chunks = [];
          let remaining = currentBlock;
          while (remaining.length > 1400) {
            let cutPoint = 1400;
            // 嘗試在換行符處分割
            const lastNewline = remaining.lastIndexOf('\n', cutPoint);
            if (lastNewline > cutPoint * 0.7) {
              cutPoint = lastNewline;
            }
            chunks.push(remaining.substring(0, cutPoint));
            remaining = remaining.substring(cutPoint);
          }
          if (remaining.length > 0) {
            chunks.push(remaining);
          }

          // 添加所有分割的塊
          chunks.forEach((chunk) => {
            components.push(new TextDisplayBuilder().setContent(chunk));
          });
        } else {
          components.push(new TextDisplayBuilder().setContent(currentBlock));
        }
      }

      mergedTextBlocks.length = 0;
    }

    processedLines.forEach((ln, index) => {
      // Guard for arrays (should be flattened)
      if (Array.isArray(ln)) return;

      switch (ln.type) {
        case LineType.Text: {
          const textStyle = (ln as any).style;
          const content = (ln as any).content;

          let processedText = content;

          const listPrefix =
            textStyle?.isList && !textStyle?.fontSize ? '- ' : '';

          if (textStyle?.bold) processedText = `**${processedText}**`;
          if (textStyle?.italic) processedText = `*${processedText}*`;
          if (textStyle?.underline) processedText = `__${processedText}__`;
          if (textStyle?.strikethrough) processedText = `~~${processedText}~~`;

          pushText(listPrefix + processedText, textStyle);
          break;
        }
        case LineType.Warp: {
          // preserve a blank line: push single newline into last block or create new blank block
          const prev = mergedTextBlocks[mergedTextBlocks.length - 1];
          if (prev) prev.text += '\n';
          else pushText('');
          break;
        }
        case LineType.Separator: {
          // flush any pending text blocks first
          flushTextBlocks();

          components.push(
            new SeparatorBuilder()
              .setSpacing(SeparatorSpacingSize.Small)
              .setDivider(true),
          );
          break;
        }
        case LineType.Image: {
          // flush text blocks
          flushTextBlocks();

          const gallery = new MediaGalleryBuilder();
          ((ln as any).url as string[])
            .slice(0, galleryLimit)
            .forEach((u) =>
              gallery.addItems(new MediaGalleryItemBuilder().setURL(u)),
            );
          components.push(gallery);
          break;
        }
        case (LineType as any).Link: {
          // Link lines — render as Markdown link [text](url) or just url
          const linkText = (ln as any).content || '';
          const linkUrl = (ln as any).url || '';
          let displayed = '';
          if (linkText.trim().length > 0 && linkUrl.trim().length > 0) {
            const styled = applyTextStyle(linkText, (ln as any).style);
            displayed = `[${styled}](${linkUrl.trim()})`;
          } else if (linkUrl.trim().length > 0) {
            displayed = linkUrl.trim();
          } else if (linkText.trim().length > 0) {
            displayed = applyTextStyle(linkText, (ln as any).style);
          }

          // Add link as text instead of separate component
          pushText(displayed, (ln as any).style);
          break;
        }
        case LineType.Video: {
          pushText(`[影片](${(ln as any).url})`, (ln as any).style);
          flushTextBlocks();

          break;
        }
      }
    });

    // flush any remaining merged text blocks
    flushTextBlocks();

    return components;
  });
}

/**
 * 檢查並將 Component Array 拆分為多個字元數小於 maxLength 的組
 * @param components 原始的 Component Array
 * @param maxLength 每組的最大字元數限制（預設 3500）
 * @returns 拆分後的 Component Array 陣列
 */
export function splitComponentsByLength(
  components: (MediaGalleryBuilder | TextDisplayBuilder | SeparatorBuilder)[],
  maxLength: number = 3500,
): (MediaGalleryBuilder | TextDisplayBuilder | SeparatorBuilder)[][] {
  if (components.length === 0) return [];

  const result: (
    | MediaGalleryBuilder
    | TextDisplayBuilder
    | SeparatorBuilder
  )[][] = [];
  let currentGroup: (
    | MediaGalleryBuilder
    | TextDisplayBuilder
    | SeparatorBuilder
  )[] = [];
  let currentLength = 0;

  /**
   * 估算單個 component 的字元數
   */
  function estimateComponentLength(
    component: MediaGalleryBuilder | TextDisplayBuilder | SeparatorBuilder,
  ): number {
    if (component instanceof TextDisplayBuilder) {
      // TextDisplay 的字元數就是其內容長度
      const content = (component as any).data?.content || '';
      return content.length;
    } else if (component instanceof MediaGalleryBuilder) {
      // MediaGallery 估算為較小的固定值（主要是 URL 長度）
      const items = (component as any).data?.items || [];
      return items.length * 100; // 假設每個項目約 100 字元
    } else if (component instanceof SeparatorBuilder) {
      // Separator 佔用很少字元
      return 10;
    }
    return 0;
  }

  for (const component of components) {
    const componentLength = estimateComponentLength(component);

    // 如果單個 component 就超過限制，需要特殊處理
    if (componentLength > maxLength) {
      // 如果當前組有內容，先推送當前組
      if (currentGroup.length > 0) {
        result.push([...currentGroup]);
        currentGroup = [];
        currentLength = 0;
      }

      // 如果是 TextDisplay 且內容過長，需要拆分
      if (component instanceof TextDisplayBuilder) {
        const content = (component as any).data?.content || '';
        if (content.length > maxLength) {
          // 將長文本拆分為多個較短的 TextDisplay
          const chunks: string[] = [];
          let remaining = content;

          while (remaining.length > maxLength - 100) {
            // 留一些緩衝
            let cutPoint = maxLength - 100;
            // 嘗試在換行符處分割
            const lastNewline = remaining.lastIndexOf('\n', cutPoint);
            if (lastNewline > cutPoint * 0.7) {
              cutPoint = lastNewline;
            } else {
              // 嘗試在空格處分割
              const lastSpace = remaining.lastIndexOf(' ', cutPoint);
              if (lastSpace > cutPoint * 0.8) {
                cutPoint = lastSpace;
              }
            }

            chunks.push(remaining.substring(0, cutPoint));
            remaining = remaining.substring(cutPoint).trim();
          }

          if (remaining.length > 0) {
            chunks.push(remaining);
          }

          // 將每個 chunk 作為單獨的組
          chunks.forEach((chunk) => {
            const newTextDisplay = new TextDisplayBuilder().setContent(chunk);
            result.push([newTextDisplay]);
          });
        } else {
          // 內容不算太長，作為單獨的組
          result.push([component]);
        }
      } else {
        // 非 TextDisplay 的大型 component，直接作為單獨的組
        result.push([component]);
      }
      continue;
    }

    // 檢查加入此 component 是否會超過限制
    if (
      currentLength + componentLength > maxLength &&
      currentGroup.length > 0
    ) {
      // 超過限制，推送當前組並開始新組
      result.push([...currentGroup]);
      currentGroup = [component];
      currentLength = componentLength;
    } else {
      // 可以加入當前組
      currentGroup.push(component);
      currentLength += componentLength;
    }
  }

  // 推送最後一組（如果有內容）
  if (currentGroup.length > 0) {
    result.push(currentGroup);
  }

  return result;
}

export default generateComponents;
