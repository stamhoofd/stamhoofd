import { getCurrentInstance } from "vue";

export function useIsMobile(): boolean {
    const app = getCurrentInstance()!;
    return app.appContext.config.globalProperties.$isMobile;
}
