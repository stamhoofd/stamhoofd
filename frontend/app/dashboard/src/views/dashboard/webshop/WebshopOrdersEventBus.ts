import { EventBus } from '@stamhoofd/components';

export const WebshopOrdersEventBus = new EventBus<"deleted", any>()