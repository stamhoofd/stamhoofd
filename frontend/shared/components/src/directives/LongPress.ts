function getScrollElement(element: HTMLElement | null = null): HTMLElement {
    if (!element) {
        element = this.$el as HTMLElement;
    }

    const style = window.getComputedStyle(element);
    if (
        style.overflowY == "scroll" ||
        style.overflow == "scroll" ||
        style.overflow == "auto" ||
        style.overflowY == "auto"
    ) {
        return element;
    } else {
        if (!element.parentElement) {
            return document.documentElement;
        }
        return getScrollElement(element.parentElement);
    }
}


export default {
    bind(el, binding, vnode) {
        el.$longPressTimer = null
        el.$didTriggerLongPress = false

        const scrollListener = (e) => {
            if (el.$longPressTimer && e.currentTarget.scrollTop > 1) {
                clearTimeout(el.$longPressTimer)
                e.currentTarget.removeEventListener("scroll", scrollListener)
            }
        }


        // Add a hover listener
        el.addEventListener(
            "touchstart",
            (event) => {
                if (el.$longPressTimer) {
                    clearTimeout(el.$longPressTimer)
                }

                // Listen for scroll event of container, and cancel
                const scrollElement = getScrollElement(el)
                scrollElement.addEventListener("scroll", scrollListener, { passive: true })

                el.$longPressTimer = setTimeout(() => {
                    scrollElement.removeEventListener("scroll", scrollListener)

                    el.$longPressTimer = null

                    // TODO: Check if not moved too much

                    // Call listener
                    
                    const callback = binding.value
                    callback(event)

                    // Cancel all move events
                    el.$didTriggerLongPress = true

                    const onmove = (e) => {
                        // Cancel all default handling from now on
                        e.preventDefault()
                    }
                    el.addEventListener("touchmove", onmove, { passive: false})
                    // Remove
                    el.addEventListener("touchend", () => {
                        el.removeEventListener("touchmove", onmove)
                    }, { once: true, passive: true })

                }, 500)
                
            },
            { passive: true }
        );

        // Add a hover listener
        el.addEventListener(
            "touchend",
            (_event) => {
                // Cancel timer
                if (el.$longPressTimer) {
                    clearTimeout(el.$longPressTimer)
                }
                el.$longPressTimer = null
                el.$didTriggerLongPress = false
                
            },
            { passive: true }
        );

        // Add a hover listener
        el.addEventListener(
            "contextmenu",
            (_event) => {
                // Cancel timer
                if (el.$longPressTimer) {
                    clearTimeout(el.$longPressTimer)
                }
                el.$longPressTimer = null
                el.$didTriggerLongPress = false
                
            },
            { passive: true }
        );
    },

    unbind(el, binding, vnode) {
        if (el.$longPressTimer) {
            clearTimeout(el.$longPressTimer)
        }
    }
};
