
export default {
    bind(el, binding, vnode) {
        el.$longPressTimer = null
        el.$didTriggerLongPress = false


        // Add a hover listener
        el.addEventListener(
            "touchstart",
            (event) => {
                if (el.$longPressTimer) {
                    clearTimeout(el.$longPressTimer)
                }

                el.$longPressTimer = setTimeout(() => {
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
            { passive: false }
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
