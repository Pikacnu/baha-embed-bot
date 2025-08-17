export interface FetchOptions {
  url: string;
  session?: string;
}

export enum PostType {
  Artwork,
  Normal,
}

export type PostInfo = {
  BSNID: number;
  subBSNID?: number;
  postId: number;
  type: PostType;
};

export type Optional<T> = {
  [P in keyof T]?: T[P];
};

export type PostData = Optional<ArtworkPostData & NormalPostData> & {
  content: Content[];
};

export type ArtworkPostData = {
  imageList: string[];
};

export type NormalPostData = {};

export enum LineType {
  Text = 'text',
  Image = 'image',
  Warp = 'warp',
  Separator = 'separator',
  Video = 'video',
  Link = 'link',
}

export type TextLine = {
  type: LineType.Text;
  content: string;
};

export type LinkLine = {
  type: LineType.Link;
  content: string;
  url: string;
};

export type ImageLine = {
  type: LineType.Image;
  url: string[];
};

export type WarpLine = {
  type: LineType.Warp;
};

export type SeparatorLine = {
  type: LineType.Separator;
};

export type VideoLine = {
  type: LineType.Video;
  url: string;
};

export enum FontSize {
  H1 = 'h1',
  H2 = 'h2',
  H3 = 'h3',
}

export const FontSizeList = [FontSize.H1, FontSize.H2, FontSize.H3];

export type TextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: FontSize;
  isList?: boolean;
};

export type Line =
  | ((
      | TextLine
      | ImageLine
      | WarpLine
      | SeparatorLine
      | VideoLine
      | LinkLine
    ) & {
      style?: TextStyle;
    })
  | Line[];

export type Author = {
  name: string;
  url: string;
};

export type HeaderContent = {
  title: string;
  author: Author;
  date?: string;
};

export enum ArtworkHeaderInfoStringType {
  Author = 'author',
  Date = 'date',
  Coins = 'coins',
  Popularity = 'popularity',
  Any = 'any',
}

export type Content = {
  header: HeaderContent;
  body: {
    lines: Line[];
  };
};
