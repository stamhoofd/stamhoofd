import type { Decoder } from '@common/encoding';
import { ObjectData } from '@common/encoding';
import { Version, Webshop } from '@stamhoofd/structures';

/**
 * The dashboard shows the real webshop in an iframe as a preview, with the settings that are not saved yet.
 * The webshop (opened with this query parameter) tells the dashboard when it is loaded, after which the dashboard
 * sends the webshop again after every change.
 */
export const webshopPreviewParameter = 'stamhoofd-preview';

const readyType = 'stamhoofd-webshop-preview-ready';
const updateType = 'stamhoofd-webshop-preview-update';

/**
 * Only the dashboard can send a webshop to a preview
 */
export function getWebshopPreviewDashboardOrigin() {
    return 'https://' + STAMHOOFD.domains.dashboard;
}

export function createWebshopPreviewReadyMessage() {
    return { type: readyType };
}

export function isWebshopPreviewReadyMessage(data: unknown): boolean {
    return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === readyType;
}

/**
 * Only the public part of the webshop: a PrivateWebshop would also send its private settings (e.g. the payment
 * settings) into the page of the webshop
 */
export function createWebshopPreviewUpdateMessage(webshop: Webshop) {
    const context = { version: Version };
    const publicWebshop = (Webshop as Decoder<Webshop>).decode(new ObjectData(webshop.encode(context), context));
    return { type: updateType, version: Version, webshop: publicWebshop.encode(context) };
}

export function decodeWebshopPreviewUpdateMessage(data: unknown): Webshop | null {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const message = data as { type?: unknown; version?: unknown; webshop?: unknown };
    if (message.type !== updateType || typeof message.version !== 'number') {
        return null;
    }
    return (Webshop as Decoder<Webshop>).decode(new ObjectData(message.webshop, { version: message.version }));
}
