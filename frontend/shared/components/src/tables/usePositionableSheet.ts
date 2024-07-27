import { PushOptions, usePresent } from "@simonbackx/vue-app-navigation";

function calculateModalPosition(event: MouseEvent) {
    const padding = 15;
    let width = 400;
    const button = event.currentTarget as HTMLElement
    const bounds = button.getBoundingClientRect()
    const win = window,
        doc = document,
        docElem = doc.documentElement,
        body = doc.getElementsByTagName("body")[0],
        clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth;

    let left = bounds.left - padding;

    if (left + width > clientWidth + padding) {
        left = clientWidth - padding - width;

        if (left < padding) {
            left = padding;
            width = clientWidth - padding * 2;
        }
    }

    const top = bounds.top + bounds.height + padding;

    return '--sheet-position-left: '+left.toFixed(1)+'px; --sheet-position-top: '+top.toFixed(1)+'px; --sheet-vertical-padding: 15px; --st-popup-width: ' + width.toFixed(1) + 'px; '
}

export function usePositionableSheet() {
    const present = usePresent();
    
    return {
        presentPositionableSheet: async (event: MouseEvent, options: PushOptions) => {
            await present({
                modalDisplayStyle: 'popup',
                modalClass: 'positionable-sheet',
                modalCssStyle: calculateModalPosition(event),
                ...options
            })
        }
    }
}
