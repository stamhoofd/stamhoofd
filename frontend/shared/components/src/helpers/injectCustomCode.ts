import { Webshop } from "@stamhoofd/structures";

import { isLocationCustomDomain } from "./isLocationCustomDomain";

export function injectCustomCode(webshop: Webshop) {
    const customCode = webshop.meta.customCode;

    if (customCode === null || !isLocationCustomDomain(webshop)) {
        return;
    }

    document.head.appendChild(
        document.createRange().createContextualFragment(customCode)
    );
}
