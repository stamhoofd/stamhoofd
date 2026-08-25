import { File as FileStruct, Image, Resolution } from '@stamhoofd/structures';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import ImageComponent from './ImageComponent.vue';

const validImageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const invalidImageSrc = 'data:image/png;base64,AAAA';

function createImage(id: string) {
    const source = new FileStruct({
        id,
        server: 'https://files.example.com',
        path: 'users/1/abc/' + id + '.png',
        name: 'photo.png',
        size: 100,
    });
    return Image.create({ source, resolutions: [new Resolution({ file: source, width: 100, height: 100 })] });
}

/**
 * File urls must be http(s), so the actual image data is swapped in per file id
 */
function mockSources(sources: Record<string, string>) {
    vi.spyOn(FileStruct.prototype, 'getPublicPath').mockImplementation(function (this: FileStruct) {
        return sources[this.id];
    });
}

function renderImage(image: Image) {
    return render(ImageComponent, {
        props: { image },
        attrs: { style: 'width: 100px; height: 100px;' },
    });
}

const img = () => document.querySelector('.image-component img');
const icon = () => document.querySelector('.image-component .icon.file-image');

afterEach(() => {
    vi.restoreAllMocks();
});

test('It renders the image when it loads', async () => {
    mockSources({ valid: validImageSrc });
    renderImage(createImage('valid'));

    await vi.waitFor(() => {
        expect(img()).not.toBeNull();
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(img()).not.toBeNull();
    expect(icon()).toBeNull();
});

test('It shows a file-image icon when the image fails to load', async () => {
    mockSources({ broken: invalidImageSrc });
    renderImage(createImage('broken'));

    await vi.waitFor(() => {
        expect(icon()).not.toBeNull();
    });
    expect(img()).toBeNull();
});

test('It retries loading when the image changes after a failure', async () => {
    mockSources({ broken: invalidImageSrc, valid: validImageSrc });
    const screen = renderImage(createImage('broken'));

    await vi.waitFor(() => {
        expect(icon()).not.toBeNull();
    });

    await screen.rerender({ image: createImage('valid') });

    await vi.waitFor(() => {
        expect(img()).not.toBeNull();
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(img()).not.toBeNull();
    expect(icon()).toBeNull();
});
