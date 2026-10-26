declare module "pdfmake/interfaces" {
  export type Content = string | Record<string, unknown>;
  export interface TDocumentDefinitions {
    [key: string]: unknown;
    content: Content[];
    footer?: (currentPage: number, pageCount: number) => Content;
  }
}

declare module "pdfmake/build/pdfmake" {
  const pdfMake: unknown;
  export = pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const virtualFiles: Record<string, string>;
  export = virtualFiles;
}
