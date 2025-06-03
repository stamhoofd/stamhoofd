import { Webshop } from "@stamhoofd/structures";

import { isLocationCustomDomain } from "./isLocationCustomDomain";

export function injectCustomCode(webshop: Webshop) {
    const customCode = webshop.meta.customCode;

    if (
        !customCode || customCode.trim().length === 0 || !isLocationCustomDomain(webshop)
    ) {
        return;
    }

    document.head.appendChild(
        document.createRange().createContextualFragment(customCode)
    );
}
