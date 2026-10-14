import { useAppContext } from '#context/appContext.ts';
import { useContext } from '#hooks/useContext.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import type { RegisterItemCheckoutHandler, RegisterItemCheckoutOptions } from './CheckoutSelectionHandlers.ts';

export function useRegisterItemCheckoutHandler(handler: RegisterItemCheckoutHandler) {
    const navigate = useNavigationActions();
    const context = useContext();
    const app = useAppContext();

    return async ({ customNavigate, ...options }: Omit<RegisterItemCheckoutOptions, 'context' | 'navigate' | 'admin'> & { customNavigate?: NavigationActions }) => {
        await handler({
            ...options,
            admin: app === 'dashboard' || app === 'admin',
            context: context.value,
            navigate: customNavigate ?? navigate,
        });
    };
}
