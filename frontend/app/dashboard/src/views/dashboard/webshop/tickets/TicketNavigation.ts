import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { Order, TicketPrivate, TicketPublicPrivate } from '@stamhoofd/structures';

export type OpenTicketHandler = (ticket: TicketPrivate | TicketPublicPrivate, order: Order, navigation: NavigationActions) => Promise<void>;
