import { useDismiss, usePop, usePresent, useShow } from "@simonbackx/vue-app-navigation"

export type NavigationActions = {show: ReturnType<typeof useShow>, present: ReturnType<typeof usePresent>, dismiss: ReturnType<typeof useDismiss>, pop: ReturnType<typeof usePop>}

export function useNavigationActions(): NavigationActions {
    const show = useShow();
    const present = usePresent();
    const pop = usePop();
    const dismiss = useDismiss();

    return {show, present, pop, dismiss};
}
