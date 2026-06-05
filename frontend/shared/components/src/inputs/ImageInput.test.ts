/// <reference types="@vitest/browser/providers/playwright" />
import { File as StructFile, Image, Resolution, ResolutionRequest } from '@stamhoofd/structures';
import { userEvent } from '@vitest/browser/context';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import type { RenderResult } from 'vitest-browser-vue';
import ImageInput from './ImageInput.vue';

function createImage(path: string, { width = 300, height = 300 }: { width?: number; height?: number } = {}): Image {
    const file = new StructFile({
        id: 'file-' + path,
        server: 'https://cdn.example.com',
        path,
        size: 100,
    });

    return Image.create({
        id: 'image-' + path,
        source: file,
        resolutions: [new Resolution({ file, width, height })],
    });
}

function renderComponent(props: Record<string, unknown> = {}, context?: unknown): RenderResult<any> {
    return render(ImageInput, {
        props: {
            title: 'Logo',
            ...props,
        },
        global: context === undefined
            ? undefined
            : {
                    provide: {
                        $context: context,
                    },
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

test('Shows the upload icon when there is no value and no placeholder', () => {
    renderComponent({ modelValue: null });

    expect(document.querySelector('.icon.upload')).not.toBeNull();
    expect(document.querySelector('img')).toBeNull();
});

test('Shows the placeholder image when there is no value but a placeholder', () => {
    renderComponent({
        modelValue: null,
        placeholder: createImage('placeholder.png'),
        required: false,
    });

    const img = document.querySelector('img')!;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/placeholder.png');

    // The sync icon is shown for an optional input with a placeholder
    expect(document.querySelector('.icon.sync')).not.toBeNull();
});

test('Shows the uploaded image when there is a value', () => {
    renderComponent({ modelValue: createImage('logo.png') });

    const img = document.querySelector('img')!;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/logo.png');
});

test('Shows the trash icon for an optional input with a value', () => {
    renderComponent({ modelValue: createImage('logo.png'), required: false });

    expect(document.querySelector('.icon.trash')).not.toBeNull();
});

test('Does not show the trash icon for a required input', () => {
    renderComponent({ modelValue: createImage('logo.png'), required: true });

    expect(document.querySelector('.icon.trash')).toBeNull();
});

test('Removes the value when clicking an optional input that has a value', async () => {
    const result = renderComponent({ modelValue: createImage('logo.png'), required: false });

    await userEvent.click(document.querySelector('.image-input-box')!);

    expect(lastEmittedModelValue(result)).toBeNull();
});

test('Does not remove the value when clicking a required input', async () => {
    const result = renderComponent({ modelValue: createImage('logo.png'), required: true });

    await userEvent.click(document.querySelector('.image-input-box')!);

    expect(result.emitted()).not.toHaveProperty('update:modelValue');
});

test('Adds the square class when a square resolution is requested', () => {
    renderComponent({
        modelValue: null,
        resolutions: [ResolutionRequest.create({ width: 100, height: 100 })],
    });

    expect(document.querySelector('.image-input-box.square')).not.toBeNull();
});

test('Does not add the square class for a non-square resolution', () => {
    renderComponent({
        modelValue: null,
        resolutions: [ResolutionRequest.create({ width: 200, height: 100 })],
    });

    expect(document.querySelector('.image-input-box.square')).toBeNull();
});

test('Adds the dark class when the dark prop is set', () => {
    renderComponent({ modelValue: null, dark: true });

    expect(document.querySelector('.image-input-box.dark')).not.toBeNull();
});

test('Shows an error and does not upload when the file is too large', async () => {
    const request = vi.fn();
    renderComponent({ modelValue: null }, { authenticatedServer: { request } });

    // 6 MB exceeds the 5 MB limit
    const file = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    await userEvent.upload(document.querySelector('input[type="file"]')!, file);

    await vi.waitFor(() => {
        expect(document.querySelector('.error-box')).not.toBeNull();
    });

    expect(request).not.toHaveBeenCalled();
});

test('Uploads the file and emits the resulting image', async () => {
    const uploadedImage = createImage('uploaded.png');
    const request = vi.fn().mockResolvedValue({ data: uploadedImage });

    const result = renderComponent({ modelValue: null }, { authenticatedServer: { request } });

    const file = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' });
    await userEvent.upload(document.querySelector('input[type="file"]')!, file);

    await vi.waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
    });

    // The image is uploaded to /upload-image
    expect(request.mock.calls[0][0]).toMatchObject({
        method: 'POST',
        path: '/upload-image',
    });

    await vi.waitFor(() => {
        expect(lastEmittedModelValue(result)).toBe(uploadedImage);
    });
});

test('Passes the private flag in the upload query when isPrivate is set', async () => {
    const request = vi.fn().mockResolvedValue({ data: createImage('uploaded.png') });

    renderComponent({ modelValue: null, isPrivate: true }, { authenticatedServer: { request } });

    const file = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' });
    await userEvent.upload(document.querySelector('input[type="file"]')!, file);

    await vi.waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
    });

    expect(request.mock.calls[0][0].query).toMatchObject({ private: true });
});
