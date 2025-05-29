import { Webshop } from '@stamhoofd/structures';

export function isLocationCustomDomain(webshop: Webshop) {
    if (!webshop.hasCustomDomain) {
        if (STAMHOOFD.environment === 'development') {
            return true;
        }
        return false;
    }
    const configuredDomain = webshop.domain;
    return location.hostname === configuredDomain;
}
