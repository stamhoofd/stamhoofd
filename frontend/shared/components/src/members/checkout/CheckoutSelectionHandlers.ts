import type { SessionContext } from '@stamhoofd/networking/SessionContext.ts';
import type { RegisterItem } from '@stamhoofd/structures';
import type { DisplayOptions, NavigationActions } from '#types/NavigationActions.ts';

export type RegisterItemCheckoutOptions = {
    item: RegisterItem;
    navigate: NavigationActions;
    context: SessionContext;
    admin?: boolean;
    displayOptions?: DisplayOptions;
    startCheckoutFlow?: boolean;
    finishHandler?: () => Promise<void> | void;
};

export type RegisterItemCheckoutHandler = (options: RegisterItemCheckoutOptions) => Promise<void>;
