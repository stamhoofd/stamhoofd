import { ComputedRef, isRef, Ref, watch } from 'vue';

export interface MetaTag {
    id: string;
    name: string;
    content: string | number | ComputedRef<string | undefined> | Ref<string | undefined> | Ref<number | undefined> | ComputedRef<number | undefined> | undefined;
}

export enum MetaKey {
    Routing = 'rid',
    Translations = 'tid',
}

export function useMetaInfo({ title, meta, options }: {
    title?: string;
    meta?: MetaTag[];
    options: {
        key: MetaKey;
        /**
         * By default all existing meta tags with the provided key will get removed before
         * adding the new meta tags. Existing meta tags will not be removed if
         * this option is set to true.
         */
        isReplaceOnly?: boolean;
    };
}) {
    if (title) {
        const titleEl = document.querySelector('head title');
        if (titleEl) {
            titleEl.textContent = title;
        }
    }

    if (meta) {
        const metaElementsToAdd: HTMLMetaElement[] = [];

        for (const data of meta) {
            const metaElement = createMetaElement(options.key, data);

            if (isRef(data.content)) {
                const intitialValue = data.content.value;
                if (intitialValue !== undefined) {
                    metaElement.setAttribute('content', intitialValue.toString());
                    metaElementsToAdd.push(metaElement);
                }

                let isVisible: boolean = intitialValue !== undefined;

                // todo: is this safe?
                watch(data.content, (newValue: string | number | undefined) => {
                    const key = 'content';

                    if (newValue) {
                        metaElement.setAttribute(key, newValue.toString());

                        if (!isVisible) {
                            replaceMetaTag(options.key, metaElement);
                        }

                        isVisible = true;
                    }
                    else {
                        metaElement.removeAttribute(key);

                        if (isVisible) {
                            removeMetaTag(metaElement);
                        }

                        isVisible = false;
                    }
                });
            }
            else if (data.content !== undefined) {
                metaElementsToAdd.push(metaElement);
            }
        }

        addMetaElementsToHead(metaElementsToAdd, options);
    }
}

function replaceMetaTag(key: MetaKey, el: HTMLMetaElement) {
    const head = getHeadElement();

    const keyValue = el.getAttribute(key);

    // remove if meta with same id exists
    if (keyValue) {
        const existingElement = head.querySelector(`meta[${key}="${keyValue}"]`);
        if (existingElement) {
            head.removeChild(existingElement);
        }
    }

    head.appendChild(el);
}

function removeMetaTag(el: HTMLMetaElement) {
    const head = getHeadElement();
    head.removeChild(el);
}

function getHeadElement(): HTMLHeadElement {
    return document.getElementsByTagName('head')[0];
}

function createMetaElement(key: MetaKey, data: MetaTag): HTMLMetaElement {
    const metaEl = document.createElement('meta');
    const copy: Record<string, string | number | ComputedRef<string | undefined> | ComputedRef<number | undefined> | Ref<string | undefined> | Ref<number | undefined> | undefined> = {
        ...data,
    };
    delete copy.id;

    metaEl.setAttribute(key, data.id);

    Object.entries(copy).forEach(([key, value]) => {
        if (value !== undefined && !isRef(value)) {
            metaEl.setAttribute(key, value.toString());
        }
    });

    return metaEl;
}

function addMetaElementsToHead(elements: HTMLMetaElement[], options: { key: MetaKey; isReplaceOnly?: boolean }) {
    const head = getHeadElement();
    const key = options.key;

    if (options.isReplaceOnly) {
        elements.forEach(el => replaceMetaTag(key, el));
    }
    else {
        const toRemove = head.querySelectorAll(`meta[${key}]`);
        // remove all existing meta tags with key
        toRemove.forEach(el => head.removeChild(el));
        // add all meta tags
        elements.forEach(el => head.appendChild(el));
    }
}
