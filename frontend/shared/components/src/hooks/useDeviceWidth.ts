import { Ref, ref } from "vue";

const width = ref(0);
let added = false;
function add() {
    added = true;
    width.value = document.documentElement.clientWidth;

    window.addEventListener('resize', () => {
        width.value = document.documentElement.clientWidth;
    }, { passive: true })
}

export function useDeviceWidth(): Ref<number> {
    if (!added) {
        add();
    }
    return width;
}
