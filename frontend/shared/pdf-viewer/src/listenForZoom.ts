export type ZoomGestureHandlers = {
    /** Removes every listener again */
    signal: AbortSignal;

    /** Zoom by `scaleFactor`, keeping `origin` (in client coordinates) where it is */
    onZoom: (scaleFactor: number, origin: [number, number]) => void;

    /** Two fingers that move while they pinch, which the browser no longer scrolls for us */
    onPan: (dx: number, dy: number) => void;
};

type TouchPoint = { clientX: number; clientY: number };

function distance(a: TouchPoint, b: TouchPoint) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function middle(a: TouchPoint, b: TouchPoint): [number, number] {
    return [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2];
}

/**
 * The gestures that zoom a pdf instead of the whole page: ctrl or cmd with the scroll wheel (also
 * what a trackpad pinch sends in Chrome and Firefox), Safari's trackpad gesture, and two fingers on
 * a touch screen. One finger and a plain scroll are left to the browser.
 *
 * pdf.js has a TouchManager for the last one, but it calls `AbortSignal.any`, which the oldest
 * Safari the app supports does not have (see the README).
 */
export function listenForZoom(element: HTMLElement, { signal, onZoom, onPan }: ZoomGestureHandlers) {
    element.addEventListener('wheel', (event) => {
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }
        event.preventDefault();

        // A line or a page of scrolling counts as much as a notch of a mouse wheel
        const delta = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? event.deltaY : event.deltaY * 30;
        onZoom(Math.exp(-delta / 100), [event.clientX, event.clientY]);
    }, { passive: false, signal });

    let pinch: { distance: number; middle: [number, number] } | null = null;

    element.addEventListener('touchstart', (event) => {
        if (event.touches.length === 2) {
            const [a, b] = [event.touches[0], event.touches[1]];
            pinch = { distance: distance(a, b), middle: middle(a, b) };
        }
    }, { passive: true, signal });

    element.addEventListener('touchmove', (event) => {
        if (!pinch || event.touches.length !== 2) {
            return;
        }
        // Otherwise the browser zooms the whole page along
        event.preventDefault();

        const [a, b] = [event.touches[0], event.touches[1]];
        const current = { distance: distance(a, b), middle: middle(a, b) };

        if (pinch.distance > 0) {
            onZoom(current.distance / pinch.distance, current.middle);
        }
        onPan(current.middle[0] - pinch.middle[0], current.middle[1] - pinch.middle[1]);
        pinch = current;
    }, { passive: false, signal });

    const endPinch = (event: TouchEvent) => {
        if (event.touches.length < 2) {
            pinch = null;
        }
    };
    element.addEventListener('touchend', endPinch, { signal });
    element.addEventListener('touchcancel', endPinch, { signal });

    // Safari sends a trackpad pinch as gesture events, with the scale since the gesture began. On iOS
    // a pinch with two fingers sends them too, next to the touches that already zoom.
    let gestureScale = 1;
    element.addEventListener('gesturestart', (event) => {
        event.preventDefault();
        gestureScale = 1;
    }, { signal });
    element.addEventListener('gesturechange', (event) => {
        event.preventDefault();
        if (pinch) {
            return;
        }

        const { scale, clientX, clientY } = event as Event & { scale: number; clientX: number; clientY: number };
        onZoom(scale / gestureScale, [clientX, clientY]);
        gestureScale = scale;
    }, { signal });
}
