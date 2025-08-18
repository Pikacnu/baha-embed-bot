import {
  type FetchOptions,
  PostType,
  type PostInfo,
  type PostData,
  type ArtworkPostData,
  type Line,
  LineType,
  type Content,
  type TextStyle,
  type HeaderContent,
  ArtworkHeaderInfoStringType,
  FontSize,
  FontSizeList,
} from './baha-type';

import * as cheerio from 'cheerio';
import { Element, type AnyNode } from 'domhandler';
import generateComponents from './component-generator';

export function typeDetection(url: string): PostType {
  if (['Co', 'C'].map((t) => `${t}.php`).some((s) => url.includes(s)))
    return PostType.Normal;
  if (['artwork'].map((t) => `${t}.php`).some((s) => url.includes(s)))
    return PostType.Artwork;
  throw new Error(`Unknown post type for pathname: ${url}`);
}

export async function fetchData({ url, session }: FetchOptions): Promise<{
  postInfo: PostInfo;
  postData?: PostData;
} | null> {
  const isNeedSession = url.includes('Co.php');
  if (isNeedSession) {
    throw new Error('Not implemented');
  }
  const params = new URL(url).searchParams;
  const postInfo: PostInfo = {
    BSNID: Number(params.get('bsn')),
    subBSNID: Number(params.get('subbsn')),
    postId: Number(params.get('snA') || params.get('sn')),
    type: typeDetection(url),
  };

  const response = await fetch(process.env.PROXY_URL!, {
    method: 'POST',
    headers: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      'XX-APIKey': process.env.PROXY_APIKEY!,
      'XX-URL': url,
    },
  });
  if (response.status !== 200) throw Error('Request Failed');
  const htmlPlainText = await response.text();

  let postData;
  switch (postInfo.type) {
    case PostType.Artwork:
      postData = artworkParser(htmlPlainText);
      break;
    case PostType.Normal:
      postData = normalParser(htmlPlainText);
      break;
  }
  return { postInfo, postData };
}

function artworkParser(htmlPlainText: string): {
  imageList: string[];
  content: Content[];
} {
  const $ = cheerio.load(htmlPlainText);
  const ImageList: string[] = [];
  $('div#div_illustration')
    .find('img')
    .each((_, elem) => {
      const $elem = $(elem);
      ImageList.push($elem.attr('src') || '');
    });
  const lines: Array<Line | undefined> = [];
  $('div#article_content')
    .first()
    .children()
    .each((_, elem) => {
      const result = lineParser(elem, $);
      if (result) {
        lines.push(result);
      }
    });
  const headerInfoArray = [
    ArtworkHeaderInfoStringType.Author,
    ArtworkHeaderInfoStringType.Any,
    ArtworkHeaderInfoStringType.Date,
    ArtworkHeaderInfoStringType.Any,
    ArtworkHeaderInfoStringType.Any,
    ArtworkHeaderInfoStringType.Coins,
    ArtworkHeaderInfoStringType.Any,
    ArtworkHeaderInfoStringType.Any,
    ArtworkHeaderInfoStringType.Popularity,
    ArtworkHeaderInfoStringType.Any,
  ];
  const header = $('div.article-intro')
    .children()
    .toArray()
    .map((elem) => {
      const $elem = $(elem);
      const type = headerInfoArray.shift();
      return {
        type,
        content:
          type === ArtworkHeaderInfoStringType.Author
            ? {
                name: $elem.text().trim(),
                url: $elem.attr('href') || '',
              }
            : type === ArtworkHeaderInfoStringType.Date
            ? {
                date: $elem.text().trim(),
              }
            : type === ArtworkHeaderInfoStringType.Any
            ? undefined
            : {
                content: Number($elem.text().trim()),
              },
      };
    })
    .filter((item) => item.type !== ArtworkHeaderInfoStringType.Any);
  return {
    imageList: ImageList,
    content: [
      {
        header: {
          title: $('h1.article-title').text().trim(),
          author: header[0]?.content,
          date: (header[1]?.content as { date?: string })?.date || '',
        },
        body: {
          lines: lines.filter((line): line is Line => !!line),
        },
      },
    ] as Content[],
  };
}

function normalParser(htmlPlainText: string): {
  content: Content[];
} {
  const $ = cheerio.load(htmlPlainText);

  const $posts = $('div.c-section__main.c-post').first();
  if ($posts.length > 0) {
    return parsePosts($, $posts);
  }

  // Fallback to original parser for older format
  const chunk: Content[] = $('section.c-section')
    .toArray()
    .filter((element) => $(element).attr('id'))
    .slice(0, 1)
    .map((sectionElement) => {
      const $elem = $(sectionElement);
      const headerElement = $elem.find('div.c-post__header');
      const authorElement = headerElement
        .find('div.c-post__header__author')
        .find('a')
        .eq(1);
      const lines = $elem
        .find('div.c-article__content')
        .toArray()
        .flatMap((elem) =>
          $(elem)
            .contents()
            .toArray()
            .map((elem) => lineParser(elem, $))
            .filter((line): line is Line | Line[] => !!line),
        );
      return {
        header: {
          title: headerElement.find('h1.c-post__header__title ').text().trim(),
          author: {
            name: authorElement.text().trim(),
            url: 'https:' + (authorElement.attr('href') || ''),
          },
          //date: $elem.find('.date').text().trim(),
        },
        body: {
          lines,
        },
      };
    })
    .filter(Boolean);
  return {
    content: chunk,
  };
}

function parsePosts(
  $: cheerio.CheerioAPI,
  posts: cheerio.Cheerio<Element>,
): {
  content: Content[];
} {
  const content: Content[] = [];

  posts.each((_, postElement) => {
    const $postElement = $(postElement);
    const $article = $postElement.find('article.c-article');

    // Extract article content
    const articleContent = $article.find('div.c-article__content');
    if (articleContent.length === 0) return;

    const lines: (Line | Line[])[] = [];

    articleContent.contents().each((_, node) => {
      const parsedLine = lineParser(node, $);
      if (parsedLine) {
        // 保留多層結構，不做扁平化
        lines.push(parsedLine);
      }
    });

    // Extract date if available
    let date = '';
    const datePattern = articleContent
      .text()
      .match(/(\d{4}[年.-]\d{1,2}[月.-]\d{1,2})/);
    if (datePattern && datePattern[1]) {
      date = datePattern[1];
    }

    const $headerElement = $postElement.find('div.c-post__header');

    const $authorElement = $headerElement
      .find('div.c-post__header__author')
      .find('a')
      .eq(1);
    content.push({
      header: {
        title: $headerElement.find('h1.c-post__header__title ').text().trim(),
        author: {
          name: $authorElement.text().trim(),
          url: 'https:' + ($authorElement.attr('href') || ''),
        },
        date: date,
      },
      body: {
        lines: lines,
      },
    });
  });

  return {
    content:
      content.length > 0
        ? content
        : [
            {
              header: {
                title: '巴哈姆特論壇文章',
                author: {
                  name: '未知作者',
                  url: '',
                },
                date: '',
              },
              body: {
                lines: [],
              },
            },
          ],
  };
}

function lineParser(
  element: AnyNode,
  $: cheerio.CheerioAPI,
  style: TextStyle = {},
): Line | Line[] | undefined {
  const $elem = $(element);

  // Skip empty text nodes and scripts
  if (element.type === 'text' && !$elem.text().trim()) {
    return;
  }
  if ($elem.is('script')) {
    return;
  }

  // Clone style to avoid mutations
  const currentStyle = { ...style };

  // Process styling elements
  if ($elem.is('b, strong')) {
    currentStyle.bold = true;
  }
  if ($elem.is('i, em')) {
    currentStyle.italic = true;
  }
  if ($elem.is('u')) {
    currentStyle.underline = true;
  }
  if ($elem.is('s, strike, del')) {
    currentStyle.strikethrough = true;
  }

  // Font size handling
  let fontSize = FontSizeList.find((size) => $elem.is(size));
  if (fontSize) {
    currentStyle.fontSize = fontSize;
  }

  // Handle font size attribute
  const fontSizeAttr = $elem.attr('size');
  if (fontSizeAttr) {
    const sizeNum = parseInt(fontSizeAttr);
    if (sizeNum >= 6) currentStyle.fontSize = FontSize.H1;
    else if (sizeNum >= 5) currentStyle.fontSize = FontSize.H2;
    else if (sizeNum >= 4) currentStyle.fontSize = FontSize.H3;
  }

  // List handling
  if ($elem.is('ul, ol, li')) {
    currentStyle.isList = true;
  }

  // Line breaks and separators
  if ($elem.is('br')) {
    return {
      type: LineType.Warp,
      style: currentStyle,
    };
  }
  if ($elem.is('hr')) {
    return {
      type: LineType.Separator,
      style: currentStyle,
    };
  }

  // Images
  const img = $elem.find('img').addBack('img');
  if (img.length) {
    const imageUrls = img
      .map((_, el) => {
        const $img = $(el);
        return (
          $img.attr('src') ||
          $img.attr('data-src') ||
          $img.attr('data-original') ||
          ''
        );
      })
      .get()
      .filter((url) => url);

    if (imageUrls.length > 0) {
      return {
        type: LineType.Image,
        url: imageUrls,
        style: currentStyle,
      };
    }
  }

  // Links
  if ($elem.is('a')) {
    const href = $elem.attr('href');
    const text = $elem.text().trim();
    if (href && text) {
      return {
        type: LineType.Link,
        url: href.startsWith('//') ? 'https:' + href : href,
        content: text,
        style: currentStyle,
      };
    }
  }

  // Videos (iframes)
  const video = $elem.find('iframe').addBack('iframe');
  if (video.length) {
    const videoUrl =
      video.first().attr('src') || video.first().attr('data-src');
    if (videoUrl) {
      return {
        type: LineType.Video,
        url: videoUrl.startsWith('//')
          ? 'https:' + videoUrl.replace('embed/', 'watch?v=')
          : videoUrl,
        style: currentStyle,
      };
    }
  }

  // Handle text nodes
  if (element.type === 'text') {
    const textContent = $elem.text().trim();
    if (textContent) {
      return {
        type: LineType.Text,
        content: textContent,
        style: currentStyle,
      };
    }
    return;
  }

  // Handle elements with mixed content (保留原本的遞迴結構)
  if ($elem.contents().length > 0) {
    const childLines: (Line | Line[])[] = [];

    $elem.contents().each((_, child) => {
      const childLine = lineParser(child, $, currentStyle);
      if (childLine) {
        // 保留多層 Array 結構，不做扁平化
        childLines.push(childLine);
      }
    });

    // If element has text content but no child elements processed, treat as text
    if (childLines.length === 0) {
      const textContent = $elem.text().trim();
      if (textContent) {
        return {
          type: LineType.Text,
          content: textContent,
          style: currentStyle,
        };
      }
    }

    return childLines.length > 0 ? childLines : undefined;
  }

  // Fallback for elements with only text content
  const textContent = $elem.text().trim();
  if (textContent) {
    return {
      type: LineType.Text,
      content: textContent,
      style: currentStyle,
    };
  }

  return undefined;
}
/** Bridge for existing consumers (index.ts) */
export function createComponentByPostData(postData?: PostData) {
  if (!postData) return [];
  // postData may contain artwork images under imageList
  const artworkImages = (postData as any).imageList as string[] | undefined;
  return generateComponents(postData.content, { artworkImages });
}
