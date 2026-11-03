import { File as StructFile, Image, Product, RichText, Webshop } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';

import { getSingleFormStepReason } from './singleFormStep.ts';

function createWebshop({ description = '' }: { description?: string } = {}) {
    const webshop = Webshop.create({});
    webshop.meta.description = RichText.create({ text: description, html: `<p>${description}</p>` });
    return webshop;
}

function createPhoto(): Image {
    return Image.create({
        source: new StructFile({ id: 'file-photo', server: 'https://cdn.example.com', path: 'photo.jpg', size: 100 }),
    });
}

describe('getSingleFormStepReason', () => {
    test('A product without a photo or description is shown on the page', () => {
        expect(getSingleFormStepReason(createWebshop({ description: 'Alle info' }), Product.create({}))).toBeNull();
    });

    test('A product photo needs a separate step', () => {
        expect(getSingleFormStepReason(createWebshop(), Product.create({ images: [createPhoto()] }))).toBe('photo');
    });

    test('A product description only needs a separate step below a webshop description', () => {
        const product = Product.create({ description: 'Over dit artikel' });
        expect(getSingleFormStepReason(createWebshop(), product)).toBeNull();
        expect(getSingleFormStepReason(createWebshop({ description: 'Alle info' }), product)).toBe('description');
    });

    test('A cleared description only has whitespace', () => {
        expect(getSingleFormStepReason(createWebshop({ description: 'Alle info' }), Product.create({ description: ' ' }))).toBeNull();
        expect(getSingleFormStepReason(createWebshop({ description: '\n' }), Product.create({ description: 'Over dit artikel' }))).toBeNull();
    });

    test('The photo comes first when the product has both', () => {
        const product = Product.create({ description: 'Over dit artikel', images: [createPhoto()] });
        expect(getSingleFormStepReason(createWebshop({ description: 'Alle info' }), product)).toBe('photo');
    });
});
