import { GlobalWorkerOptions } from 'pdfjs-dist';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { defineComponent, h, ref } from 'vue';
import PdfViewer from './PdfViewer.vue';
import { createTestPdf } from './tests/createTestPdf.ts';

const viewerWidth = 400;

type ViewerOptions = {
    horizontal?: boolean;
    fixedHeight?: boolean;
    onLoaded?: (info: { pageCount: number }) => void;
    onPage?: (pageNumber: number) => void;
};

const globalOptions = {
    config: {
        globalProperties: {
            $t: (globalThis as any).$t ?? ((value: string) => value),
        } as any,
    },
};

function renderViewer(data: Uint8Array, onError?: (error: Error) => void, { horizontal, fixedHeight, onLoaded, onPage }: ViewerOptions = {}) {
    return render(PdfViewer, {
        props: { data, horizontal, fixedHeight },
        attrs: { style: `width: ${viewerWidth}px;`, onError, onLoaded, onPage },
        global: globalOptions,
    });
}

function textLayers() {
    return [...document.querySelectorAll<HTMLElement>('.pdf-viewer-page .textLayer')];
}

function viewerElement() {
    return document.querySelector<HTMLElement>('.pdf-viewer')!;
}

function wheel(options: WheelEventInit) {
    const rect = viewerElement().getBoundingClientRect();
    const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        ...options,
    });
    viewerElement().dispatchEvent(event);
    return event;
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

    // The canvas gets its size before pdf.js has painted into it
    const canvas = paintedCanvases()[0];
    await vi.waitFor(() => {
        expect(isBlank(canvas)).toBe(false);
    }, { timeout: 10_000 });

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

/**
 * pdf.js 6 calls `AbortSignal.any`, which iOS below 17.4 does not have, but only from its
 * annotation editor, its touch manager and the `TextLayerBuilder` of its viewer app. The viewer
 * mounts none of them - its text layer is the core `TextLayer` - so it needs no polyfill. This keeps
 * that true, for the text on top of the page as well.
 */
test('It renders without AbortSignal.any, which iOS below 17.4 lacks', async () => {
    const any = vi.spyOn(AbortSignal, 'any');

    try {
        renderViewer(createTestPdf({ pageCount: 3 }));

        await vi.waitFor(() => {
            expect(countDarkPixels(paintedCanvases()[0])).toBeGreaterThan(500);
            expect(textLayers()[0].textContent).toContain('Pagina 1 van 3');
        }, { timeout: 10_000 });

        expect(any).not.toHaveBeenCalled();
    }
    finally {
        any.mockRestore();
    }
});

/**
 * pdf.js assigns `globalThis.pdfjsWorker` at module scope of its worker build, and any consumer
 * that imports that module on the main thread sends every other consumer in the bundle to the main
 * thread with it. The viewer bundles the worker as a worker and hands pdf.js the port, so it
 * neither sets that global nor depends on `GlobalWorkerOptions`.
 */
test('It renders on a real worker it brings itself', async () => {
    renderViewer(createTestPdf({ pageCount: 1 }));

    await vi.waitFor(() => {
        expect(countDarkPixels(paintedCanvases()[0])).toBeGreaterThan(500);
    }, { timeout: 10_000 });

    expect((globalThis as any).pdfjsWorker).toBeUndefined();
    expect(GlobalWorkerOptions.workerSrc).toBeFalsy();
});

test('It reports the number of pages once the document is open, and starts on the first', async () => {
    const onLoaded = vi.fn();
    const onPage = vi.fn();
    renderViewer(createTestPdf({ pageCount: 3 }), undefined, { onLoaded, onPage });

    await vi.waitFor(() => {
        expect(onLoaded).toHaveBeenCalledOnce();
    }, { timeout: 10_000 });

    expect(onLoaded).toHaveBeenCalledWith({ pageCount: 3 });
    expect(onPage).toHaveBeenCalledWith(1);
});

test('It lays the text of a page on top of it, so it can be selected', async () => {
    renderViewer(createTestPdf({ pageCount: 1 }));

    await vi.waitFor(() => {
        expect(textLayers()[0].textContent).toContain('Pagina 1 van 1');
    }, { timeout: 10_000 });

    const span = textLayers()[0].querySelector('span')!;
    expect(getComputedStyle(span).color).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(span).userSelect).toBe('text');
});

test('It lays the pages of a horizontal viewer out next to each other, each as wide as the viewer', async () => {
    renderViewer(createTestPdf({ pageCount: 3 }), undefined, { horizontal: true });

    await vi.waitFor(() => {
        expect(paintedCanvases().length).toBeGreaterThan(0);
    }, { timeout: 10_000 });

    const [first, second] = pageElements().map(page => page.getBoundingClientRect());
    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThanOrEqual(first.right);
    expect(first.width).toBeCloseTo(viewerWidth, 0);

    // The viewer scrolls through them itself, rather than growing as wide as all of them
    expect(viewerElement().scrollWidth).toBeGreaterThan(viewerElement().clientWidth);
});

test('It goes to a page of a horizontal viewer, and reports the page it is on', async () => {
    const onPage = vi.fn();
    const viewer = ref<InstanceType<typeof PdfViewer> | null>(null);
    const data = createTestPdf({ pageCount: 3 });

    render(defineComponent({
        setup: () => () => h(PdfViewer, { ref: viewer, data, horizontal: true, style: `width: ${viewerWidth}px;`, onPage }),
    }), { global: globalOptions });

    await vi.waitFor(() => {
        expect(paintedCanvases().length).toBeGreaterThan(0);
    }, { timeout: 10_000 });

    viewer.value!.goToPage(3);

    // It scrolls there smoothly, so the page is reported before it has arrived
    await vi.waitFor(() => {
        const page = pageElements()[2].getBoundingClientRect();
        const root = viewerElement().getBoundingClientRect();
        expect(page.left).toBeGreaterThanOrEqual(root.left);
        expect(page.right).toBeLessThanOrEqual(root.right);
    }, { timeout: 10_000 });
    expect(onPage).toHaveBeenLastCalledWith(3);
});

test('It zooms with ctrl and the scroll wheel, and draws the page again at that size once it pauses', async () => {
    renderViewer(createTestPdf({ pageCount: 1 }));

    await vi.waitFor(() => {
        expect(paintedCanvases()).toHaveLength(1);
    }, { timeout: 10_000 });
    const canvasWidth = paintedCanvases()[0].width;

    const event = wheel({ ctrlKey: true, deltaY: -100 });

    // The page zooms, not the whole document around it
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
        expect(viewerElement().classList.contains('zoomed')).toBe(true);
    });
    expect(pageElements()[0].getBoundingClientRect().width).toBeGreaterThan(viewerWidth);

    await vi.waitFor(() => {
        expect(paintedCanvases()[0].width).toBeGreaterThan(canvasWidth);
    }, { timeout: 10_000 });
});

test('It leaves a plain scroll to the browser, and zooms out no further than a page that fits', async () => {
    renderViewer(createTestPdf({ pageCount: 1 }));

    await vi.waitFor(() => {
        expect(paintedCanvases()).toHaveLength(1);
    }, { timeout: 10_000 });

    expect(wheel({ deltaY: -100 }).defaultPrevented).toBe(false);
    wheel({ ctrlKey: true, deltaY: 100 });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(viewerElement().classList.contains('zoomed')).toBe(false);
    expect(pageElements()[0].getBoundingClientRect().width).toBeCloseTo(viewerWidth, 0);
});

test('It zooms with two fingers that move apart', async () => {
    renderViewer(createTestPdf({ pageCount: 1 }));

    await vi.waitFor(() => {
        expect(paintedCanvases()).toHaveLength(1);
    }, { timeout: 10_000 });

    const element = viewerElement();
    const rect = element.getBoundingClientRect();
    const y = rect.top + 100;
    const touches = (spread: number) => [
        new Touch({ identifier: 1, target: element, clientX: rect.left + 200 - spread, clientY: y }),
        new Touch({ identifier: 2, target: element, clientX: rect.left + 200 + spread, clientY: y }),
    ];

    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: touches(50) }));
    const move = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: touches(100) });
    element.dispatchEvent(move);

    // Otherwise the browser zooms the whole page along
    expect(move.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
        expect(element.classList.contains('zoomed')).toBe(true);
    });
    expect(pageElements()[0].getBoundingClientRect().width).toBeGreaterThan(viewerWidth * 1.5);
});

test('It keeps the height of one page with fixedHeight, and scrolls up and down itself when zoomed', async () => {
    renderViewer(createTestPdf({ pageCount: 1 }), undefined, { horizontal: true, fixedHeight: true });

    await vi.waitFor(() => {
        expect(paintedCanvases()).toHaveLength(1);
    }, { timeout: 10_000 });

    const height = viewerElement().getBoundingClientRect().height;
    expect(viewerElement().scrollHeight).toBeLessThanOrEqual(viewerElement().clientHeight + 1);

    wheel({ ctrlKey: true, deltaY: -100 });

    await vi.waitFor(() => {
        expect(viewerElement().scrollHeight).toBeGreaterThan(viewerElement().clientHeight + 1);
    });
    expect(viewerElement().getBoundingClientRect().height).toBe(height);
});
