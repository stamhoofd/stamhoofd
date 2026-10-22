import type { SessionContext } from '@stamhoofd/frontend-session/SessionContext';
import type { NavigationActions } from '#types/NavigationActions.ts';

export type FreshAction = <T>(action: () => Promise<T>, options?: {
    context: SessionContext;
    navigation: NavigationActions;
}) => Promise<T>;
