import { Injectable } from '@nestjs/common';
import { JSDOM, type DOMWindow } from 'jsdom';
import htmlToPdfmake from 'html-to-pdfmake';
import pdfMake = require('pdfmake/build/pdfmake');
import pdfFonts = require('pdfmake/build/vfs_fonts');

type PdfMakeModule = typeof pdfMake & {
  virtualfs: { existsSync(path: string): boolean; readFileSync(path: string): Buffer };
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

let dom: JSDOM | null = null;
function getWindow(): DOMWindow {
  dom ??= new JSDOM('<!doctype html><html><body></body></html>');
  return dom.window;
}

@Injectable()
export class PdfService {
  /** Render an HTML fragment to a PDF Buffer. */
  renderHtml(html: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pageMargins: [number, number, number, number] = [40, 44, 40, 44];
        const documentDefinition = {
          content: htmlToPdfmake(html, { window: getWindow() }),
          defaultStyle: { font: 'Roboto', fontSize: 11 },
          pageSize: 'A4' as const,
          pageMargins,
        };
        const doc = pdfMakeRuntime.createPdf(documentDefinition) as unknown as {
          getBuffer(callback: (buffer: Uint8Array) => void): void;
        };
        doc.getBuffer((buffer) => {
          resolve(Buffer.from(buffer));
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
