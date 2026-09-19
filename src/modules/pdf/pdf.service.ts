import { Injectable } from '@nestjs/common';
import { JSDOM, type DOMWindow } from 'jsdom';
import htmlToPdfmake from 'html-to-pdfmake';
import pdfMake = require('pdfmake/build/pdfmake');
import pdfFonts = require('pdfmake/build/vfs_fonts');
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

type PdfMakeModule = typeof pdfMake & {
  virtualfs: {
    existsSync(path: string): boolean;
    readFileSync(path: string): Buffer;
  };
  fonts: Record<string, Record<'normal' | 'bold' | 'italics' | 'bolditalics', string>>;
};

// pdfmake 0.3 reads fonts through a filesystem-like virtualfs; wrap the bundled
// base64 font map so Roboto resolves in Node. (The UMD build exposes virtualfs
// as a plain property, so assigning here is safe.)
const pdfMakeRuntime = pdfMake as PdfMakeModule;
const fontMap = pdfFonts as unknown as Record<string, string>;
pdfMakeRuntime.virtualfs = {
  existsSync: (path) => Object.prototype.hasOwnProperty.call(fontMap, path),
  readFileSync: (path) => Buffer.from(fontMap[path], 'base64'),
};

// CSS font-families emitted by html-to-pdfmake (Helvetica, Arial, ...) must be
// present in the UMD instance's `fonts` map or PDFKit throws "Font 'X' is not
// defined". Alias every family to the bundled Roboto files.
const ROBOTO_FONT = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Medium.ttf',
  italics: 'Roboto-Italic.ttf',
  bolditalics: 'Roboto-MediumItalic.ttf',
};
pdfMakeRuntime.fonts = {
  Roboto: ROBOTO_FONT,
  Helvetica: ROBOTO_FONT,
  Arial: ROBOTO_FONT,
  'sans-serif': ROBOTO_FONT,
  Times: ROBOTO_FONT,
  Courier: ROBOTO_FONT,
};

let dom: JSDOM | null = null;
function getWindow(): DOMWindow {
  dom ??= new JSDOM('<!doctype html><html><body></body></html>');
  return dom.window;
}

// html-to-pdfmake sometimes emits whitespace nodes with `margin: ["", 0]`
// (CSS `margin: 0 auto` → the auto value becomes an empty string). A string
// margin poisons pdfkit's layout coordinates (e.g. "400-2.728515625") and
// crashes with `unsupported number`. Normalize all numeric layout fields.
function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n as number) ? (n as number) : 0;
}

function sanitizeContent(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => sanitizeContent(item));
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'margin' || key === 'padding') {
        out[key] = Array.isArray(value)
          ? value.map((v) => toNumber(v))
          : toNumber(value);
      } else if (
        key === 'marginTop' ||
        key === 'marginRight' ||
        key === 'marginBottom' ||
        key === 'marginLeft' ||
        key === 'paddingTop' ||
        key === 'paddingRight' ||
        key === 'paddingBottom' ||
        key === 'paddingLeft'
      ) {
        out[key] = toNumber(value);
      } else if (value && typeof value === 'object') {
        out[key] = sanitizeContent(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return node;
}

@Injectable()
export class PdfService {
  /** Render an HTML fragment to a PDF Buffer. */
  async renderHtml(html: string): Promise<Buffer> {
    const pageMargins: [number, number, number, number] = [40, 44, 40, 44];
    const documentDefinition = {
      content: sanitizeContent(
        htmlToPdfmake(html, { window: getWindow() }),
      ) as unknown as TDocumentDefinitions['content'],
      defaultStyle: { font: 'Roboto', fontSize: 11 },
      pageSize: 'A4' as const,
      pageMargins,
    };
    // pdfmake 0.3 getBuffer() returns a Promise<Buffer> (the legacy callback
    // API never invokes the callback in this version).
    const doc = pdfMakeRuntime.createPdf(documentDefinition) as unknown as {
      getBuffer(): Promise<Buffer>;
    };
    return doc.getBuffer();
  }
}
