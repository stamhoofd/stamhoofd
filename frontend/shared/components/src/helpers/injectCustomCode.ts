import type { Webshop } from '@stamhoofd/structures';
import { isLocationCustomDomain } from './isLocationCustomDomain';

export function injectCustomCode(webshop: Webshop) {
    const customCode = webshop.meta.customCode;

    if (!customCode || customCode.trim().length === 0 || !isLocationCustomDomain(webshop)) {
        return;
    }

    // createContextualFragment ignores the strict-dynamic CSP requirement
    // this code is always inserted by the webshop admin, so it is safe to run.
    // eslint-disable-next-line no-unsanitized/method -- Deliberately executes admin-provided custom code only on the webshop's custom domain, guarded above.
    const fragment = document.createRange().createContextualFragment(customCode);
    document.head.appendChild(fragment);
}
