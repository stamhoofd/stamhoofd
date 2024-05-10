import { Request } from "@simonbackx/simple-networking";
import { onBeforeUnmount } from "vue";

export function useRequestOwner() {
    const owner = {};

    onBeforeUnmount(() => {
        Request.cancelAll(owner);
    })

    return owner;
}