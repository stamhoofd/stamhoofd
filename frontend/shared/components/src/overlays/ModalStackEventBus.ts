import type { ComponentWithProperties, PushOptions } from '@browser/navigation';

import { EventBus } from '@stamhoofd/frontend-application/EventBus';

export const ModalStackEventBus = new EventBus<'present', PushOptions | ComponentWithProperties>();
export const ReplaceRootEventBus = new EventBus<'replace', ComponentWithProperties>();

/** On mboile we have an extra top level modal stack to display updates over everyting and make it non removeable and non collisionable */
export const MobileRootEventBus = new EventBus<'present', PushOptions | ComponentWithProperties>();
