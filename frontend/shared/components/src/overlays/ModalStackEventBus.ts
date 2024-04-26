import { ComponentWithProperties, PushOptions } from "@simonbackx/vue-app-navigation";

import { EventBus } from "../EventBus";

export const ModalStackEventBus = new EventBus<"present", PushOptions | ComponentWithProperties>()
export const ReplaceRootEventBus = new EventBus<"replace", ComponentWithProperties>()