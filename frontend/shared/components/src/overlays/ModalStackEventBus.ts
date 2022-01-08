import { ComponentWithProperties, PushOptions } from "@simonbackx/vue-app-navigation";

import { EventBus } from "../EventBus";

export const ModalStackEventBus = new EventBus<"present", PushOptions | ComponentWithProperties>()