/**
 * GIF encoder for exporting animations as animated GIFs
 * Implements LZW compression and GIF89a format
 */

const PALETTE = buildPalette();

/**
 * GIF encoder class
 */
export class GifEncoder {
  private width: number;
  private height: number;
  private delay: number;
  private bytes: number[];

  constructor(width: number, height: number, delayMs: number) {
    this.width = width;
    this.height = height;
    this.delay = Math.max(1, Math.round(delayMs / 10));
    this.bytes = [];

    this.writeText('GIF89a');
    this.writeWord(width);
    this.writeWord(height);
    this.writeByte(0xf7);
    this.writeByte(0);
    this.writeByte(0);
    this.writeBytes(PALETTE);
    this.writeLoopExtension();
  }

  /**
   * Add frame to GIF
   */
  addFrame(imageData: ImageData): void {
    this.writeGraphicControl();
    this.writeImageDescriptor();
    this.writeByte(8);
    this.writeSubBlocks(lzwEncode(indexPixels(imageData.data)));
  }

  /**
   * Finish encoding and return blob
   */
  finish(): Blob {
    this.writeByte(0x3b);
    return new Blob([new Uint8Array(this.bytes)], { type: 'image/gif' });
  }

  private writeLoopExtension(): void {
    this.writeBytes([0x21, 0xff, 0x0b]);
    this.writeText('NETSCAPE2.0');
    this.writeBytes([0x03, 0x01, 0x00, 0x00, 0x00]);
  }

  private writeGraphicControl(): void {
    this.writeBytes([0x21, 0xf9, 0x04, 0x00]);
    this.writeWord(this.delay);
    this.writeBytes([0x00, 0x00]);
  }

  private writeImageDescriptor(): void {
    this.writeByte(0x2c);
    this.writeWord(0);
    this.writeWord(0);
    this.writeWord(this.width);
    this.writeWord(this.height);
    this.writeByte(0);
  }

  private writeSubBlocks(data: number[]): void {
    for (let index = 0; index < data.length; index += 255) {
      const block = data.slice(index, index + 255);
      this.writeByte(block.length);
      this.writeBytes(block);
    }
    this.writeByte(0);
  }

  private writeText(text: string): void {
    for (const char of text) {
      this.writeByte(char.charCodeAt(0));
    }
  }

  private writeWord(value: number): void {
    this.writeByte(value & 0xff);
    this.writeByte((value >> 8) & 0xff);
  }

  private writeByte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  private writeBytes(values: number[]): void {
    this.bytes.push(...values);
  }
}

/**
 * Build 256-color palette
 */
function buildPalette(): number[] {
  const palette: number[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let g = 0; g < 8; g += 1) {
      for (let b = 0; b < 4; b += 1) {
        palette.push(Math.round((r / 7) * 255));
        palette.push(Math.round((g / 7) * 255));
        palette.push(Math.round((b / 3) * 255));
      }
    }
  }
  return palette;
}

/**
 * Convert RGBA pixels to palette indices
 */
function indexPixels(rgba: Uint8ClampedArray): Uint8Array {
  const indexed = new Uint8Array(rgba.length / 4);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
    const r = (rgba[source] ?? 0) >> 5;
    const g = (rgba[source + 1] ?? 0) >> 5;
    const b = (rgba[source + 2] ?? 0) >> 6;
    indexed[target] = (r << 5) | (g << 2) | b;
  }
  return indexed;
}

/**
 * LZW compression for GIF
 */
function lzwEncode(indices: Uint8Array): number[] {
  const minCodeSize = 8;
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dictionary = initialDictionary();
  const writer = new BitWriter();

  writer.write(clearCode, codeSize);
  let current = String(indices[0]);

  for (let index = 1; index < indices.length; index += 1) {
    const value = indices[index];
    const combined = `${current},${value}`;

    if (dictionary.has(combined)) {
      current = combined;
      continue;
    }

    const code = dictionary.get(current);
    if (code !== undefined) {
      writer.write(code, codeSize);
    }

    if (nextCode < 4096) {
      dictionary.set(combined, nextCode);
      nextCode += 1;
      if (nextCode === 1 << codeSize && codeSize < 12) {
        codeSize += 1;
      }
    } else {
      writer.write(clearCode, codeSize);
      dictionary = initialDictionary();
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
    }

    current = String(value);
  }

  const finalCode = dictionary.get(current);
  if (finalCode !== undefined) {
    writer.write(finalCode, codeSize);
  }
  writer.write(endCode, codeSize);

  return writer.finish();
}

/**
 * Initialize LZW dictionary
 */
function initialDictionary(): Map<string, number> {
  const dictionary = new Map<string, number>();
  for (let index = 0; index < 256; index += 1) {
    dictionary.set(String(index), index);
  }
  return dictionary;
}

/**
 * Bit writer for LZW encoding
 */
class BitWriter {
  private bytes: number[];
  private buffer: number;
  private bits: number;

  constructor() {
    this.bytes = [];
    this.buffer = 0;
    this.bits = 0;
  }

  write(code: number, size: number): void {
    this.buffer |= code << this.bits;
    this.bits += size;

    while (this.bits >= 8) {
      this.bytes.push(this.buffer & 0xff);
      this.buffer >>= 8;
      this.bits -= 8;
    }
  }

  finish(): number[] {
    if (this.bits > 0) {
      this.bytes.push(this.buffer & 0xff);
    }
    return this.bytes;
  }
}
