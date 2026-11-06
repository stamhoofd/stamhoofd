import { expect, test } from 'vitest';
import { getRenderScale, maxCanvasPixels, maxPixelRatio } from './getRenderScale.ts';

const a4 = { pageWidth: 595, pageHeight: 842 };

test('It fits the page to the available width at the sharpness of the screen', () => {
    expect(getRenderScale({ ...a4, cssWidth: 595, pixelRatio: 1 })).toBe(1);
    expect(getRenderScale({ ...a4, cssWidth: 595, pixelRatio: 2 })).toBe(2);
    expect(getRenderScale({ ...a4, cssWidth: 297.5, pixelRatio: 2 })).toBe(1);
});

test('It never renders below one device pixel per css pixel', () => {
    expect(getRenderScale({ ...a4, cssWidth: 595, pixelRatio: 0.5 })).toBe(1);
});

test('It stops getting sharper past the pixel ratio we support', () => {
    expect(getRenderScale({ ...a4, cssWidth: 595, pixelRatio: 8 })).toBe(maxPixelRatio);
});

test('It lowers the resolution rather than cross the canvas limit', () => {
    const scale = getRenderScale({ ...a4, cssWidth: 2000, pixelRatio: 3 });
    const pixels = a4.pageWidth * scale * a4.pageHeight * scale;

    expect(pixels).toBeLessThanOrEqual(maxCanvasPixels);
    expect(pixels).toBeCloseTo(maxCanvasPixels, -3);
});

test('It keeps the aspect ratio of a page that is not A4', () => {
    const scale = getRenderScale({ pageWidth: 1190, pageHeight: 300, cssWidth: 595, pixelRatio: 1 });

    expect(scale).toBe(0.5);
});
