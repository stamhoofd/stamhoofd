import { EventBus } from '../../../classes/EventBus';

export const WebshopOrdersEventBus = new EventBus<"deleted", any>()