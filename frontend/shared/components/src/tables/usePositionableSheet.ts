import { PushOptions, usePresent } from '@simonbackx/vue-app-navigation';

export type PositionableSheetOptions = {
    innerPadding?: number; // Padding inside the sheet
    width?: number;
    padding?: number;
    position?: 'fixed' | 'absolute';
    yPlacement?: 'bottom' | 'top';
    minimumHeight?: number;
};

function calculateModalPosition(event: MouseEvent, options?: PositionableSheetOptions) {
    const padding = options?.padding ?? 15;
    const innerPadding = options?.innerPadding ?? 15;
    let yPlacement = options?.yPlacement ?? 'bottom';

    let width = options?.width ?? 400;
    const button = event.currentTarget as HTMLElement;
    const bounds = button.getBoundingClientRect();
    const win = window,
        doc = document,
        docElem = doc.documentElement,
        body = doc.getElementsByTagName('body')[0],
        clientWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
        clientHeight = win.innerHeight || docElem.clientHeight || body.clientHeight;

    let left = bounds.left - innerPadding;

    if (left + width > clientWidth + innerPadding) {
        left = clientWidth - innerPadding - width;

        if (left < innerPadding) {
            left = innerPadding;
            width = clientWidth - innerPadding * 2;
        }
    }

    let top = bounds.top + bounds.height + padding;
    let bottom = 0;
    let vh: string | undefined;

    if (options?.position === 'absolute') {
        vh = '1%';

        // Since top = 0, means relative to our offsetParent, we need to adjust the top and left values to account for our offset parent's position
        const stackComponent = button.closest('.modal-stack-component') as HTMLElement;
        if (stackComponent) {
            const offsetParent = stackComponent.offsetParent as HTMLElement;
            if (offsetParent) {
                const offsetBounds = offsetParent.getBoundingClientRect();
                left -= offsetBounds.left;
                top -= offsetBounds.top;
            }
            else {
                top += window.scrollY;
            }
        }
        else {
            top += window.scrollY;
        }
    }

    let suffix = '';
    if (vh) {
        suffix = `; --vh: ${vh};`;
    }

    const remainingHeight = clientHeight - top;
    const remainingHeightTop = clientHeight - (clientHeight - bounds.top + padding);
    const minimumHeight = options?.minimumHeight ?? Math.min(300, 0.25 * clientHeight);
    if ((remainingHeight < minimumHeight && remainingHeightTop > remainingHeight) || (yPlacement === 'top' && !(remainingHeightTop < minimumHeight && remainingHeight > remainingHeightTop))) {
        // Switch up
        top = 0;
        bottom = clientHeight - bounds.top + padding;
        yPlacement = 'top';
    }

    return {
        style: '--sheet-position: ' + (options?.position ?? 'fixed') + '; --sheet-position-left: ' + left.toFixed(1) + 'px; --sheet-position-top: ' + top.toFixed(1) + 'px; --sheet-position-bottom: ' + bottom.toFixed(1) + 'px; --sheet-vertical-padding: 15px; --st-popup-width: ' + width.toFixed(1) + 'px; --st-sheet-width: ' + width.toFixed(1) + 'px; ' + suffix,
        class: 'y-' + yPlacement,
    };
}

export function usePositionableSheet() {
    const present = usePresent();

    return {
        presentPositionableSheet: async (event: MouseEvent, options: PushOptions, positionOptions?: PositionableSheetOptions) => {
            const position = calculateModalPosition(event, positionOptions);
            await present({
                modalDisplayStyle: 'popup',
                modalClass: 'positionable-sheet ' + position.class,
                modalCssStyle: position.style,
                ...options,
            });
        },
    };
}
