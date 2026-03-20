import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';

import type { ObjectDirective } from 'vue';
import { ModalStackEventBus } from '../overlays/ModalStackEventBus';
import Tooltip from '../overlays/Tooltip.vue';

const helper = {
    copyElementFallback(event: Event) {
        if (!(event.target instanceof HTMLElement)) {
            return;
        }

        event.target.contentEditable = 'true';

        document.execCommand('selectAll', false);
        document.execCommand('copy');

        event.target.contentEditable = 'false';

        const w = window as any;
        if (w.getSelection) {
            if (w.getSelection().empty) { // Chrome
                w.getSelection().empty();
            }
            else if (w.getSelection().removeAllRanges) { // Firefox
                w.getSelection().removeAllRanges();
            }
        }
        this.copiedPopup(event);

        (document.activeElement as HTMLElement)?.blur();
    },

    copiedPopup(event: Event) {
        const _el = event.currentTarget || event.target;
        if (!_el || !(_el instanceof HTMLElement)) {
            return;
        }
        const el = _el as HTMLElement & {$tooltipDisplayedComponent?: undefined | null |  ComponentWithProperties};
        const rect = el.getBoundingClientRect();

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: $t(`%a7`),
            icon: '',
            x: rect.left,
            y: rect.top + el.offsetHeight + 5,
        });

        ModalStackEventBus.sendEvent('present', {
            components: [
                displayedComponent,
            ],
            modalDisplayStyle: 'overlay',
        }).catch(console.error);

        setTimeout(() => {
            (displayedComponent.componentInstance() as any)?.hide?.();
        }, 1000);

        if (el.$tooltipDisplayedComponent) {
            try {
                (el.$tooltipDisplayedComponent.componentInstance() as any)?.hide?.();
                el.$tooltipDisplayedComponent = null;
            }
            catch (e) {
                // ignore
            }
        }
        el.$tooltipDisplayedComponent = displayedComponent;

        // Add style
        el.classList.add('copied');
        setTimeout(() => {
            el.classList.remove('copied');
        }, 500);
    },

    copyElement(event: MouseEvent, bindingValue: string | undefined) {
        if (window.getSelection() !== null && window.getSelection()!.toString().length > 0) {
            return;
        }
        if (navigator.clipboard) {
            // Select all
            const myText = bindingValue ?? (event.currentTarget as HTMLElement)?.textContent?.trim() ?? '';
            navigator.clipboard.writeText(myText).then(() => {
                this.copiedPopup(event);
            }).catch((e) => {
                console.error(e);
                this.copyElementFallback(event);
            });
        }
        else {
            console.warn('No navigator.clipboard support');
            this.copyElementFallback(event);
        }
    },
};

const CopyableDirective: ObjectDirective<HTMLElement & { _copyableValue: null | string }, string> = {
    beforeMount(el, binding) {
        // Add a hover listener
        el.addEventListener(
            'click',
            (event) => {
                helper.copyElement(event, el._copyableValue ?? binding.value);
            },
            { passive: true },
        );
    },

    updated(el, binding) {
        el._copyableValue = binding.value;
    },
};

export default CopyableDirective;
