import { useFocused } from "@simonbackx/vue-app-navigation";
import { unref, onActivated, onMounted, onBeforeUnmount, onDeactivated } from "vue";

export function useKeyUpDown(actions: {up: () => void, down: () => void}) {
    const isFocused = useFocused()
    const onKey = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.repeat) {
            return;
        }
    
        if (!unref(isFocused)) {
            return
        }
    
        const key = event.key || event.keyCode;
    
        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            actions.up();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            actions.down();
            event.preventDefault();
        }
    }

    const remove = () => {
        document.removeEventListener("keydown", onKey);
    }

    const add = () => {
        remove();
        document.addEventListener("keydown", onKey);
    }

    onActivated(() => {
        add()
    });

    onMounted(() => {
        add()
    });

    onBeforeUnmount(() => {
        remove();
    })

    onDeactivated(() => {
        remove();
    })
}
