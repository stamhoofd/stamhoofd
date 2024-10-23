import { getCurrentInstance } from 'vue';

export function useIsMac(): boolean {
    const app = getCurrentInstance()!;
    return app.appContext.config.globalProperties.$isMac;
}
