import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { NavigationActions } from '#types/NavigationActions.ts';

export type FreshAction = <T>(action: () => Promise<T>, options?: {
    context: SessionContext;
    navigation: NavigationActions;
}) => Promise<T>;
