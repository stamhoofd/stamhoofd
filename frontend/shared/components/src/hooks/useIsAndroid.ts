import { getCurrentInstance } from "vue";

export function useIsAndroid(): boolean {
    const app = getCurrentInstance()!;
    return app.appContext.config.globalProperties.$isAndroid;
}
