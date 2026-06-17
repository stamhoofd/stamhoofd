import type { ComponentWithProperties, PushOptions } from '@simonbackx/vue-app-navigation';

import { EventBus } from '../EventBus';

export const ModalStackEventBus = new EventBus<'present', PushOptions | ComponentWithProperties>();
export const ReplaceRootEventBus = new EventBus<'replace', ComponentWithProperties>();

/** On mboile we have an extra top level modal stack to display updates over everyting and make it non removeable and non collisionable */
export const MobileRootEventBus = new EventBus<'present', PushOptions | ComponentWithProperties>();
