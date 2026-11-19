/**
 * Browsers cap how large a canvas may be, and iOS Safari caps it lowest of all: past the cap it
 * hands back a blank canvas instead of throwing. A page is rendered at a lower resolution instead.
 */
export const maxCanvasPixels = 2 ** 23;

/**
 * Rendering sharper than three device pixels per css pixel is invisible on the screens we support,
 * while every page keeps its canvas in memory for as long as it stays near the viewport.
 */
export const maxPixelRatio = 3;

/**
 * The scale to pass to `page.getViewport`, so a page of `pageWidth` x `pageHeight` pdf units fills
 * `cssWidth` css pixels at the sharpness of the screen, without crossing the canvas cap.
 */
export function getRenderScale({ cssWidth, pageWidth, pageHeight, pixelRatio }: { cssWidth: number; pageWidth: number; pageHeight: number; pixelRatio: number }): number {
    const scale = (cssWidth / pageWidth) * Math.min(Math.max(pixelRatio, 1), maxPixelRatio);
    const pixels = pageWidth * scale * pageHeight * scale;

    if (pixels > maxCanvasPixels) {
        return scale * Math.sqrt(maxCanvasPixels / pixels);
    }

    return scale;
}
