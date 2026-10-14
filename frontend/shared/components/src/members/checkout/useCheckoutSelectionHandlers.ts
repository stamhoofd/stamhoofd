import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner.ts';
import { PlatformFamilyHelper } from '@stamhoofd/structures/helpers/PlatformFamilyHelper.js';
import { useAppContext } from '#context/appContext.ts';
import { useContext } from '#hooks/useContext.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import type { ChooseGroupForMemberHandler, ChooseGroupForMemberOptions, DefaultRegisterItemHandler, DefaultRegisterItemOptions, RegisterItemCheckoutHandler, RegisterItemCheckoutOptions } from './CheckoutSelectionHandlers.ts';

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

export function useDefaultRegisterItemHandler(handler: DefaultRegisterItemHandler) {
    const context = useContext();
    const owner = useRequestOwner();

    return async (options: Omit<DefaultRegisterItemOptions, 'context' | 'owner'>) => {
        return await handler({ ...options, context: context.value, owner });
    };
}

export function useChooseGroupForMemberHandler(handler: ChooseGroupForMemberHandler) {
    const navigate = useNavigationActions();
    const context = useContext();
    const app = useAppContext();

    return async ({ customNavigate, ...options }: Omit<ChooseGroupForMemberOptions, 'context' | 'navigate' | 'admin'> & { customNavigate?: NavigationActions }) => {
        if (app !== 'registration') {
            PlatformFamilyHelper.getCheckout(options.member.family).clear();
        }

        await handler({
            ...options,
            admin: app === 'dashboard' || app === 'admin',
            context: context.value,
            navigate: customNavigate ?? navigate,
            startCheckoutFlow: options.startCheckoutFlow ?? (app !== 'registration'),
        });
    };
}
