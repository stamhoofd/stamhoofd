import { PushOptions, usePresent } from "@simonbackx/vue-app-navigation";

export type PositionableSheetOptions = {
    width?: number, padding?: number 
}

function calculateModalPosition(event: MouseEvent, options?: PositionableSheetOptions) {
    const padding = options?.padding ?? 15;
    const innerPadding = 15;

    let width = options?.width ?? 400;
    const button = event.currentTarget as HTMLElement
    const bounds = button.getBoundingClientRect()
    const win = window,
        doc = document,
        docElem = doc.documentElement,
        body = doc.getElementsByTagName("body")[0],
        clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth;

    let left = bounds.left - innerPadding;

    if (left + width > clientWidth + innerPadding) {
        left = clientWidth - innerPadding - width;

        if (left < innerPadding) {
            left = innerPadding;
            width = clientWidth - innerPadding * 2;
        }
    }

    const top = bounds.top + bounds.height + padding;

    return '--sheet-position-left: '+left.toFixed(1)+'px; --sheet-position-top: '+top.toFixed(1)+'px; --sheet-vertical-padding: 15px; --st-popup-width: ' + width.toFixed(1) + 'px; '
}

export function usePositionableSheet() {
    const present = usePresent();
    
    return {
        presentPositionableSheet: async (event: MouseEvent, options: PushOptions, positionOptions?: PositionableSheetOptions) => {
            await present({
                modalDisplayStyle: 'popup',
                modalClass: 'positionable-sheet',
                modalCssStyle: calculateModalPosition(event, positionOptions),
                ...options
            })
        }
    }
}
