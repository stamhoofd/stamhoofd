import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import PdfViewer from './PdfViewer.vue';
import { createTestPdf } from './tests/createTestPdf.ts';

const viewerWidth = 400;

function renderViewer(data: Uint8Array, onError?: (error: Error) => void) {
    return render(PdfViewer, {
        props: { data },
        attrs: { style: `width: ${viewerWidth}px;`, onError },
        global: {
            config: {
                globalProperties: {
                    $t: (globalThis as any).$t ?? ((value: string) => value),
                } as any,
            },
        },
    });
}

function pageElements() {
    return [...document.querySelectorAll<HTMLElement>('.pdf-viewer-page')];
}

/**
 * A page that has not been rendered keeps a canvas without a backing store, so its size is the
 * difference between a page that holds its place in the document and a page that was painted.
 */
function paintedCanvases() {
    return [...document.querySelectorAll<HTMLCanvasElement>('.pdf-viewer-page canvas')].filter(canvas => canvas.width > 0 && canvas.height > 0);
}

function isBlank(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')!;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

    for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 0) {
            return false;
        }
    }

    return true;
}

/**
 * The fixture paints black text on a light grey block, so dark pixels are glyphs and nothing else.
 */
function countDarkPixels(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')!;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;

    for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] !== 0 && data[index] < 100) {
            dark++;
        }
    }

    return dark;
}

test('It renders a one page document as a single page', async () => {
    renderViewer(createTestPdf({ pageCount: 1 }));

    await vi.waitFor(() => {
        expect(paintedCanvases()).toHaveLength(1);
    }, { timeout: 10_000 });

    expect(pageElements()).toHaveLength(1);

    const canvas = paintedCanvases()[0];
    expect(isBlank(canvas)).toBe(false);

    // An extract leans on Helvetica without embedding it, so the text of a page only appears if
    // pdf.js substitutes the standard fonts. The fixture does the same.
    await vi.waitFor(() => {
        expect(countDarkPixels(canvas)).toBeGreaterThan(500);
    }, { timeout: 10_000 });

    // A4 at 400 css pixels wide, times the pixel ratio of the screen running the test.
    expect(canvas.width / canvas.height).toBeCloseTo(595 / 842, 2);
    expect(canvas.width).toBeGreaterThanOrEqual(viewerWidth);
});

test('It gives every page of a long document its place without rendering them all', async () => {
    const pageCount = 40;
    renderViewer(createTestPdf({ pageCount }));

    await vi.waitFor(() => {
        expect(paintedCanvases().length).toBeGreaterThan(0);
    }, { timeout: 10_000 });

    expect(pageElements()).toHaveLength(pageCount);

    // Every page holds a page-shaped place in the scroll height from the start.
    for (const page of pageElements()) {
        expect(page.offsetHeight).toBeGreaterThan(page.offsetWidth);
    }

    expect(paintedCanvases().length).toBeLessThan(pageCount);
});

test('It renders a page of a long document once it is scrolled to', async () => {
    const pageCount = 40;
    renderViewer(createTestPdf({ pageCount }));

    await vi.waitFor(() => {
        expect(paintedCanvases().length).toBeGreaterThan(0);
    }, { timeout: 10_000 });

    const lastPage = pageElements()[pageCount - 1];
    expect(lastPage.querySelector<HTMLCanvasElement>('canvas')!.width).toBe(0);

    lastPage.scrollIntoView();

    await vi.waitFor(() => {
        const canvas = lastPage.querySelector<HTMLCanvasElement>('canvas')!;
        expect(canvas.width).toBeGreaterThan(0);
        expect(countDarkPixels(canvas)).toBeGreaterThan(500);
    }, { timeout: 10_000 });
});

test('It keeps the bytes it was given, which the app still needs after rendering', async () => {
    const data = createTestPdf({ pageCount: 1 });
    const size = data.byteLength;

    renderViewer(data);

    await vi.waitFor(() => {
        expect(paintedCanvases()).toHaveLength(1);
    }, { timeout: 10_000 });

    expect(data.byteLength).toBe(size);
});

test('It reports a document it cannot open', async () => {
    const onError = vi.fn();
    renderViewer(new Uint8Array([1, 2, 3, 4]), onError);

    await vi.waitFor(() => {
        expect(document.querySelector('.pdf-viewer .error-box')).not.toBeNull();
    }, { timeout: 10_000 });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(pageElements()).toHaveLength(0);
});
