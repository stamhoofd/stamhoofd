import { File as StructFile, Image, Resolution } from '@stamhoofd/structures';
import { userEvent } from 'vitest/browser';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import type { RenderResult } from 'vitest-browser-vue';
import ImageDropArea from './ImageDropArea.vue';

const validImageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

afterEach(() => {
    vi.restoreAllMocks();
});

function createImage(path: string): Image {
    const file = new StructFile({
        id: 'file-' + path,
        server: 'https://cdn.example.com',
        path,
        size: 100,
    });

    return Image.create({
        id: 'image-' + path,
        source: file,
        resolutions: [new Resolution({ file, width: 1800, height: 600 })],
    });
}

function renderComponent(props: Record<string, unknown> = {}, context?: unknown): RenderResult<any> {
    return render(ImageDropArea, {
        props: {
            title: 'Omslagfoto',
            ...props,
        },
        global: {
            mocks: {
                $t: (globalThis as any).$t,
            },
            provide: context === undefined ? {} : { $context: context },
        },
    });
}

function lastEmittedModelValue(result: RenderResult<any>): Image | null | undefined {
    const emitted = result.emitted<(Image | null)[]>('update:modelValue');
    if (emitted === undefined) {
        return undefined;
    }
    return emitted[emitted.length - 1][0];
}

function dropArea() {
    return document.querySelector<HTMLElement>('[data-testid="image-drop-area"]')!;
}

function dispatchDrag(type: 'dragenter' | 'dragleave' | 'drop', files: File[] = []) {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
        dataTransfer.items.add(file);
    }
    dropArea().dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
}

test('Shows the title and description when there is no image', () => {
    renderComponent({ modelValue: null, description: 'Minstens 1600 pixels breed' });

    expect(dropArea().textContent).toContain('Omslagfoto');
    expect(dropArea().textContent).toContain('Minstens 1600 pixels breed');
    expect(document.querySelector('img')).toBeNull();
});

test('Shows the image when there is a value', async () => {
    vi.spyOn(StructFile.prototype, 'getPublicPath').mockImplementation(() => validImageSrc);
    renderComponent({ modelValue: createImage('cover.png') });

    // ImageComponent renders the <img> once it has measured its size
    await vi.waitFor(() => {
        expect(document.querySelector('img')?.getAttribute('src')).toBe(validImageSrc);
    });
    expect(document.querySelector('.image-drop-area.has-image')).not.toBeNull();
});

test('Uploads a selected file and emits the resulting image', async () => {
    const uploadedImage = createImage('uploaded.png');
    const request = vi.fn().mockResolvedValue({ data: uploadedImage });
    const result = renderComponent({ modelValue: null }, { optionalAuthenticatedServer: { request } });

    const file = new File([new Uint8Array(10)], 'cover.png', { type: 'image/png' });
    await userEvent.upload(document.querySelector('input[type="file"]')!, file);

    await vi.waitFor(() => {
        expect(lastEmittedModelValue(result)).toBe(uploadedImage);
    });
    expect(request.mock.calls[0][0]).toMatchObject({
        method: 'POST',
        path: '/upload-image',
    });
});

test('Uploads a dropped file and emits the resulting image', async () => {
    const uploadedImage = createImage('uploaded.png');
    const request = vi.fn().mockResolvedValue({ data: uploadedImage });
    const result = renderComponent({ modelValue: null }, { optionalAuthenticatedServer: { request } });

    dispatchDrag('drop', [new File([new Uint8Array(10)], 'cover.png', { type: 'image/png' })]);

    await vi.waitFor(() => {
        expect(lastEmittedModelValue(result)).toBe(uploadedImage);
    });
    expect(request).toHaveBeenCalledTimes(1);
});

test('Shows an error and does not upload when a dropped file is not an image', async () => {
    const request = vi.fn();
    const result = renderComponent({ modelValue: null }, { optionalAuthenticatedServer: { request } });

    dispatchDrag('drop', [new File(['hello'], 'notes.txt', { type: 'text/plain' })]);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });
    expect(request).not.toHaveBeenCalled();
    expect(result.emitted()).not.toHaveProperty('update:modelValue');
});

test('Shows an error and does not upload when the file is too large', async () => {
    const request = vi.fn();
    renderComponent({ modelValue: null }, { optionalAuthenticatedServer: { request } });

    // 6 MB exceeds the 5 MB limit
    dispatchDrag('drop', [new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })]);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });
    expect(request).not.toHaveBeenCalled();
});

test('Highlights the area while a file is dragged over it, including over child elements', async () => {
    renderComponent({ modelValue: null });

    dispatchDrag('dragenter');
    // Moving onto a child element fires dragenter on the child before dragleave on the parent
    dispatchDrag('dragenter');
    dispatchDrag('dragleave');

    await vi.waitFor(() => {
        expect(dropArea().classList.contains('dragging')).toBe(true);
    });

    dispatchDrag('dragleave');

    await vi.waitFor(() => {
        expect(dropArea().classList.contains('dragging')).toBe(false);
    });
});

test('Removes the image when clicking the delete button', async () => {
    const result = renderComponent({ modelValue: createImage('cover.png') });

    await userEvent.click(document.querySelector('[data-testid="image-drop-area-delete"]')!);

    expect(lastEmittedModelValue(result)).toBeNull();
});

test('Shows the image full width and crops it at the max height', async () => {
    vi.spyOn(StructFile.prototype, 'getPublicPath').mockImplementation(() => validImageSrc);
    renderComponent({ modelValue: createImage('cover.png'), maxHeight: 200 });

    await vi.waitFor(() => {
        expect(document.querySelector('img')).not.toBeNull();
    });

    const imageComponent = document.querySelector<HTMLElement>('.image-component')!;
    expect(imageComponent.style.maxHeight).toBe('200px');
    expect(getComputedStyle(document.querySelector('img')!).objectFit).toBe('cover');
});
