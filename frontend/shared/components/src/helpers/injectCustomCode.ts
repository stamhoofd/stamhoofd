import { Webshop } from '@stamhoofd/structures';
import { isLocationCustomDomain } from './isLocationCustomDomain';

export function injectCustomCode(webshop: Webshop) {
    const customCode = webshop.meta.customCode;

    if (customCode === null || !isLocationCustomDomain(webshop)) {
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(customCode, 'text/html');

    for (const child of [...doc.body.children]) {
        if (isScriptElement(child)) {
            const script = document.createElement('script');
            [...child.attributes].forEach((attr) => {
                script.setAttribute(attr.name, attr.value);
            });

            script.text = child.innerHTML;
            document.body.appendChild(script);
            continue;
        }

        if (isStyleElement(child)) {
            document.head.appendChild(child);
            continue;
        }

        document.body.appendChild(child);
    }
}

function isStyleElement(element: Element): element is HTMLScriptElement {
    return element?.tagName === 'STYLE';
}

function isScriptElement(element: Element): element is HTMLScriptElement {
    return element.tagName === 'SCRIPT';
}
