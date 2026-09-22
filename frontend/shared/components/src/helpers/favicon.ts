import type { Organization, Webshop } from '@stamhoofd/structures';
import { getWebshopIdentity } from './webshopIdentity.ts';

/**
 * Uses the square logo that is shown in the interface as the favicon, so the tab matches the header.
 * An existing favicon is never replaced: the first caller wins.
 */
export function setFavicon(organization: Organization, webshop?: Webshop | null) {
    const squareLogo = getWebshopIdentity(organization, webshop).metaData.squareLogo;
    if (!squareLogo) {
        return;
    }

    if (document.querySelector("link[rel='icon']")) {
        return;
    }

    const href = squareLogo.getPathForSize(256, 256);
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = href.endsWith('.svg') ? 'image/svg+xml' : (href.endsWith('.png') ? 'image/png' : 'image/jpeg');
    link.href = href;

    document.head.appendChild(link);
}
