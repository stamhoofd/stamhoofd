import { File as StructFile, Image, Organization, Resolution, Webshop } from '@stamhoofd/structures';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { setFavicon } from './favicon.ts';

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
        resolutions: [new Resolution({ file, width: 210, height: 210 })],
    });
}

function faviconHref(): string | null {
    return document.querySelector("link[rel='icon']")?.getAttribute('href') ?? null;
}

function removeFavicons() {
    // The test runner sets a favicon of its own
    document.querySelectorAll("link[rel='icon']").forEach(element => element.remove());
}

beforeEach(removeFavicons);
afterEach(removeFavicons);

describe('setFavicon', () => {
    test('A webshop that shows the logo of its organization also gets its favicon', () => {
        const organization = Organization.create({ name: 'Scouts Gent' });
        organization.meta.squareLogo = createImage('organization.png');

        // A webshop keeps the logo it uploaded before it switched back to the organization logo
        const webshop = Webshop.create({});
        webshop.meta.useLogo = false;
        webshop.meta.squareLogo = createImage('webshop.png');

        setFavicon(organization, webshop);

        expect(faviconHref()).toBe('https://cdn.example.com/organization.png');
    });

    test('A webshop with its own logo gets its own favicon', () => {
        const organization = Organization.create({ name: 'Scouts Gent' });
        organization.meta.squareLogo = createImage('organization.png');

        const webshop = Webshop.create({});
        webshop.meta.useLogo = true;
        webshop.meta.squareLogo = createImage('webshop.svg');

        setFavicon(organization, webshop);

        const link = document.querySelector("link[rel='icon']");
        expect(link?.getAttribute('href')).toBe('https://cdn.example.com/webshop.svg');
        expect(link?.getAttribute('type')).toBe('image/svg+xml');
    });

    test('It sets no favicon when the identity that is shown has no square logo', () => {
        const organization = Organization.create({ name: 'Scouts Gent' });
        organization.meta.squareLogo = createImage('organization.png');

        const webshop = Webshop.create({});
        webshop.meta.useLogo = true;

        setFavicon(organization, webshop);

        expect(faviconHref()).toBeNull();
    });

    test('It keeps a favicon that is already set', () => {
        const existing = document.createElement('link');
        existing.rel = 'icon';
        existing.href = 'https://cdn.example.com/existing.png';
        document.head.appendChild(existing);

        const organization = Organization.create({ name: 'Scouts Gent' });
        organization.meta.squareLogo = createImage('organization.png');

        setFavicon(organization, null);

        expect(document.querySelectorAll("link[rel='icon']").length).toBe(1);
        expect(faviconHref()).toBe('https://cdn.example.com/existing.png');
    });
});
