import type { RouteNavigationOptions } from '@simonbackx/vue-app-navigation';
import type { AppRoute } from '@stamhoofd/structures';

export type AppNavigateFunction = (route: AppRoute, options?: RouteNavigationOptions<any, any>) => Promise<void>;

let _appNavigateFn: AppNavigateFunction | null = null;

export function provideAppNavigate(fn: AppNavigateFunction): void {
    _appNavigateFn = fn;
}

// Returns a lazy wrapper so callers can safely call useAppNavigate() during setup,
// even if provideAppNavigate() hasn't been called yet at that moment.
export function useAppNavigate(): AppNavigateFunction {
    return (route, options) => {
        if (!_appNavigateFn) {
            throw new Error('useAppNavigate: provideAppNavigate was not called');
        }
        return _appNavigateFn(route, options);
    };
}
