import { AppManager } from "@stamhoofd/networking";
import type {ObjectDirective} from "vue";

function getScrollElement(element: HTMLElement | null = null): HTMLElement {
    if (!element) {
        element = this.$el as HTMLElement;
    }

    const style = window.getComputedStyle(element);
    if (
        style.overflowY == "scroll" ||
        style.overflow == "scroll" ||
        style.overflow == "auto" ||
        style.overflowY == "auto" || 
        style.overflow == "overlay" || 
        style.overflowY == "overlay"
    ) {
        return element;
    } else {
        if (!element.parentElement) {
            return document.documentElement;
        }
        return getScrollElement(element.parentElement);
    }
}

function distance(a: { x: number, y: number }, b: { x: number, y: number }) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

const LongPressDirective: ObjectDirective<HTMLElement & {$longPressTimer: NodeJS.Timeout|null, $didTriggerLongPress: boolean}, () => void> = {
    beforeMount(el, binding) {
        // If we are on Android or Desktop, we can ignore this listener
        if (!(binding.instance as any).$isIOS) {
            return
        }

        el.$longPressTimer = null
        el.$didTriggerLongPress = false
        
        let scrollElement: HTMLElement | undefined
        let firstTouch: { x: number, y: number } | undefined
        let lastTouch: { x: number, y: number } | undefined


        const scrollListener = (e) => {
            if (el.$longPressTimer && e.currentTarget.scrollTop > 1) {
                clearTimeout(el.$longPressTimer)
                e.currentTarget.removeEventListener("scroll", scrollListener)
            }
        }

        const touchMoveListener = (event) => {
            if (!event.touches || event.touches.length < 1) {
                return
            }
            lastTouch = {
                x: event.touches[0].pageX,
                y: event.touches[0].pageY
            }
        }

        const cancelLongPress = () => {
            // Cancel timer
            if (el.$longPressTimer) {
                clearTimeout(el.$longPressTimer)
            }
            el.$longPressTimer = null
            el.$didTriggerLongPress = false
            scrollElement?.removeEventListener("scroll", scrollListener)
            document.removeEventListener("touchmove", touchMoveListener)
        }


        // Add a hover listener
        el.addEventListener(
            "touchstart",
            (event) => {
                cancelLongPress()

                if (event.touches.length > 1) {
                    // If more than one finger, do nothing
                    return
                }

                if (event.target && event.target.classList.contains('drag')) {
                    return;
                }

                // Register position of touch
                firstTouch = {
                    x: event.touches[0].pageX,
                    y: event.touches[0].pageY
                }
                lastTouch = {
                    x: event.touches[0].pageX,
                    y: event.touches[0].pageY
                }

                // Listen for scroll event of container, and cancel if scrolled
                scrollElement = getScrollElement(el)
                scrollElement.addEventListener("scroll", scrollListener, { passive: true })
                
                document.addEventListener("touchmove", touchMoveListener, { passive: true })

                el.$longPressTimer = setTimeout(() => {
                    scrollElement?.removeEventListener("scroll", scrollListener)
                    document.removeEventListener("touchmove", touchMoveListener)

                    // If distance between first touch and last touch is too big, do nothing
                    if (!firstTouch || !lastTouch || distance(firstTouch, lastTouch) > 5) {
                        cancelLongPress()
                        return
                    }
                    console.log(el, el.getAttribute('draggable'))

                    el.$longPressTimer = null

                    AppManager.shared.hapticTap()

                    // Call listener
                    const callback = binding.value

                    const customEvent = {
                        currentTarget: el,
                        target: el,
                        changedTouches: event.changedTouches,
                        touches: event.touches,
                    }
                    callback(customEvent)

                    // Cancel all move events
                    el.$didTriggerLongPress = true

                    const onmove = (e) => {
                        // Cancel all default handling from now on
                        e.preventDefault()
                    }
                    document.addEventListener("touchmove", onmove, { passive: false})
                    // Remove
                    document.addEventListener("touchend", () => {
                        document.removeEventListener("touchmove", onmove)
                    }, { once: true, passive: true })

                }, 500)
                
            },
            { passive: true }
        );

        // Add a hover listener
        el.addEventListener(
            "touchend",
            (_event) => {
                cancelLongPress()
                
            },
            { passive: true }
        );

        // Add a hover listener
        el.addEventListener(
            "contextmenu",
            (_event) => {
                // Cancel timer
                cancelLongPress()
                
            },
            { passive: true }
        );
    },

    unmounted(el, binding, vnode) {
        if (el.$longPressTimer) {
            clearTimeout(el.$longPressTimer)
        }
    }
};
export default LongPressDirective;