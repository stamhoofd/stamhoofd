import { getCurrentInstance } from "vue";

export function useIsIOS(): boolean {
    const app = getCurrentInstance()!;
    return app.appContext.config.globalProperties.$isIOS;
}
