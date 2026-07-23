import type { Webshop } from '@stamhoofd/structures';
import { isLocationCustomDomain } from './isLocationCustomDomain';

export function injectCustomCode(webshop: Webshop) {
    const customCode = webshop.meta.customCode;

    if (!customCode || customCode.trim().length === 0 || !isLocationCustomDomain(webshop)) {
        return;
    }

    // createContextualFragment ignores the strict-dynamic CSP requirement
    // this code is always inserted by the webshop admin, so it is safe to run.
    const fragment = document.createRange().createContextualFragment(customCode);
    document.head.appendChild(fragment);
}
