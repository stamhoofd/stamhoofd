import { File as StructFile, Image, Organization, Resolution, Webshop } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';

import { getWebshopSquareLogo } from './webshopIdentity.ts';

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

function createOrganization() {
    const organization = Organization.create({ name: 'Scouts Gent' });
    organization.meta.squareLogo = createImage('organization.png');
    return organization;
}

describe('getWebshopSquareLogo', () => {
    test('Uses the square logo of the webshop', () => {
        const webshop = Webshop.create({});
        webshop.meta.useLogo = true;
        webshop.meta.squareLogo = createImage('webshop.png');

        expect(getWebshopSquareLogo(createOrganization(), webshop)?.logo.id).toBe('image-webshop.png');
    });

    test('A webshop with only a horizontal logo has no square logo', () => {
        const webshop = Webshop.create({});
        webshop.meta.useLogo = true;
        webshop.meta.horizontalLogo = createImage('webshop-horizontal.png');

        expect(getWebshopSquareLogo(createOrganization(), webshop)).toBeNull();
    });

    test('Never uses the organization logo when the webshop disabled it', () => {
        const webshop = Webshop.create({});
        webshop.meta.useLogo = true;

        expect(getWebshopSquareLogo(createOrganization(), webshop)).toBeNull();
    });

    test('Ignores the logos a webshop kept after switching back to the organization logo', () => {
        const webshop = Webshop.create({});
        webshop.meta.useLogo = false;
        webshop.meta.horizontalLogo = createImage('webshop-horizontal.png');

        expect(getWebshopSquareLogo(createOrganization(), webshop)?.logo.id).toBe('image-organization.png');
    });

    test('No logo when the organization has no square logo either', () => {
        expect(getWebshopSquareLogo(Organization.create({ name: 'Scouts Gent' }), Webshop.create({}))).toBeNull();
    });
});
