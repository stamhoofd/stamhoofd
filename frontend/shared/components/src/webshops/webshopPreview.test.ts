import { PrivateWebshop, WebshopMetaData, WebshopPrivateMetaData, WebshopStatus } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';

import { createWebshopPreviewReadyMessage, createWebshopPreviewUpdateMessage, decodeWebshopPreviewUpdateMessage, forceWebshopOpenForPreview, isWebshopPreviewReadyMessage } from './webshopPreview.ts';

function createWebshop() {
    return PrivateWebshop.create({
        meta: WebshopMetaData.create({ name: 'Spaghettiavond', title: 'Nog niet opgeslagen' }),
        privateMeta: WebshopPrivateMetaData.create({ notificationEmails: ['kassa@example.com'] }),
    });
}

describe('webshopPreview', () => {
    test('Sends the webshop with the changes that are not saved yet', () => {
        const webshop = createWebshop();
        const decoded = decodeWebshopPreviewUpdateMessage(createWebshopPreviewUpdateMessage(webshop));

        expect(decoded?.id).toBe(webshop.id);
        expect(decoded?.meta.title).toBe('Nog niet opgeslagen');
    });

    test('Leaves out the private settings of the webshop', () => {
        const message = createWebshopPreviewUpdateMessage(createWebshop());

        expect(message.webshop).not.toHaveProperty('privateMeta');
        expect(JSON.stringify(message)).not.toContain('kassa@example.com');
    });

    test('Ignores other messages', () => {
        const message = createWebshopPreviewUpdateMessage(createWebshop());

        expect(decodeWebshopPreviewUpdateMessage(null)).toBeNull();
        expect(decodeWebshopPreviewUpdateMessage('stamhoofd-webshop-preview-update')).toBeNull();
        expect(decodeWebshopPreviewUpdateMessage({ ...message, type: 'other' })).toBeNull();
        expect(decodeWebshopPreviewUpdateMessage({ ...message, version: undefined })).toBeNull();
        expect(decodeWebshopPreviewUpdateMessage(createWebshopPreviewReadyMessage())).toBeNull();
    });

    test('Recognizes the ready message of the webshop', () => {
        expect(isWebshopPreviewReadyMessage(createWebshopPreviewReadyMessage())).toBe(true);
        expect(isWebshopPreviewReadyMessage(createWebshopPreviewUpdateMessage(createWebshop()))).toBe(false);
        expect(isWebshopPreviewReadyMessage(null)).toBe(false);
        expect(isWebshopPreviewReadyMessage('stamhoofd-webshop-preview-ready')).toBe(false);
    });

    test('Shows a closed webshop as open', () => {
        const webshop = createWebshop();
        webshop.meta.status = WebshopStatus.Closed;

        const open = forceWebshopOpenForPreview(webshop);

        expect(open.isClosed()).toBe(false);
        expect(open.meta.title).toBe('Nog niet opgeslagen');
        // The settings in the dashboard stay closed
        expect(webshop.meta.status).toBe(WebshopStatus.Closed);
    });

    test('Shows a webshop that opens later as open', () => {
        const webshop = createWebshop();
        webshop.meta.openAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        expect(forceWebshopOpenForPreview(webshop).isClosed()).toBe(false);
    });

    test('Shows a webshop that closed on its end date as open', () => {
        const webshop = createWebshop();
        webshop.meta.availableUntil = new Date(Date.now() - 24 * 60 * 60 * 1000);

        expect(forceWebshopOpenForPreview(webshop).isClosed()).toBe(false);
    });

    test('Keeps an end date in the future', () => {
        const webshop = createWebshop();
        const availableUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        webshop.meta.availableUntil = availableUntil;

        expect(forceWebshopOpenForPreview(webshop).meta.availableUntil).toEqual(availableUntil);
    });
});
