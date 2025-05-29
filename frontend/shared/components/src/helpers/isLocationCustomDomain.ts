import { Webshop } from "@stamhoofd/structures";

export function isLocationCustomDomain(webshop: Webshop) {
    if (STAMHOOFD.environment === "development") {
        return true;
    }

    if (!webshop.hasCustomDomain) {
        return false;
    }

    const configuredDomain = webshop.domain;
    if (configuredDomain === null) {
        return false;
    }

    const blackList = new Set([
        ...Object.values(STAMHOOFD.domains.webshop ?? {}),
        STAMHOOFD.domains.legacyWebshop,
        STAMHOOFD.domains.dashboard,
        ...Object.values(STAMHOOFD.domains.registration ?? {}),
    ]);

    if (blackList.has(configuredDomain)) {
        return false;
    }

    return location.hostname === configuredDomain;
}
