import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';

import type { ObjectDirective, Ref } from 'vue';
import { ref } from 'vue';
import { ModalStackEventBus } from '../..';
import Tooltip from '../overlays/Tooltip.vue';

const TooltipDirective: ObjectDirective<HTMLElement & { $tooltipDisplayedComponent: null | ComponentWithProperties } & { $tooltipBindingValue: Ref<string> | undefined }, string> = {
    beforeMount(el, binding) {
        let isMouseHover = false;
        const displayedComponent: ComponentWithProperties | null = el.$tooltipDisplayedComponent ?? null;
        el.$tooltipDisplayedComponent = displayedComponent;

        if (!binding.value || typeof binding.value !== 'string') {
            // Don't set the ref here, for any visible tooltips to remain visible
            el.$tooltipBindingValue = undefined;
            return;
        }

        if ('ontouchstart' in window) {
            // Ignore on touch devices
            return;
        }

        el.$tooltipBindingValue = ref(binding.value);

        // Add a hover listener
        el.addEventListener(
            'mouseover',
            (_event) => {
                if (!isMouseHover) {
                    isMouseHover = true;

                    setTimeout(() => {
                        if (isMouseHover && !el.$tooltipDisplayedComponent) {
                            if (!el.$tooltipBindingValue || !el.$tooltipBindingValue.value || typeof el.$tooltipBindingValue.value !== 'string') {
                                // No tooltip set any longer
                                return;
                            }

                            const rect = el.getBoundingClientRect();

                            // Present
                            el.$tooltipDisplayedComponent = new ComponentWithProperties(Tooltip, {
                                text: el.$tooltipBindingValue,
                                x: rect.left,
                                y: rect.bottom,
                                xPlacement: 'right',
                                yPlacement: 'bottom',
                                wrapHeight: rect.height,
                            });

                            ModalStackEventBus.sendEvent('present', {
                                components: [
                                    el.$tooltipDisplayedComponent,
                                ],
                                modalDisplayStyle: 'overlay',
                            }).catch(console.error);
                        }
                    }, 200);
                }
            },
            { passive: true },
        );
        el.addEventListener(
            'mouseleave',
            (_event) => {
                isMouseHover = false;

                if (el.$tooltipDisplayedComponent && el.$tooltipDisplayedComponent.vnode) {
                    try {
                        (el.$tooltipDisplayedComponent.componentInstance() as any)?.hide();
                    } catch (e) {
                        // Ignore
                        console.error(e);
                    }
                }
                el.$tooltipDisplayedComponent = null;
            },
            { passive: true },
        );
    },

    updated(el, binding) {
        if (el.$tooltipBindingValue) {
            el.$tooltipBindingValue.value = binding.value;

            if (!binding.value) {
                if (el.$tooltipDisplayedComponent) {
                    try {
                        (el.$tooltipDisplayedComponent.componentInstance() as any)?.hide();
                    } catch (e) {
                        // Ignore
                        console.error(e);
                    }
                }
                el.$tooltipDisplayedComponent = null;
            }
        }
    },

    unmounted(el, binding, vnode) {
        if (el.$tooltipDisplayedComponent) {
            try {
                (el.$tooltipDisplayedComponent.componentInstance() as any)?.hide();
            } catch (e) {
                // Ignore
                console.error(e);
            }
        }
        el.$tooltipDisplayedComponent = null;
    },
};

export default TooltipDirective;
