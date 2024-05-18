import { useDismiss, usePop, usePresent, useShow } from "@simonbackx/vue-app-navigation"

export type NavigationActions = {show: ReturnType<typeof useShow>, present: ReturnType<typeof usePresent>, dismiss: ReturnType<typeof useDismiss>, pop: ReturnType<typeof usePop>}
