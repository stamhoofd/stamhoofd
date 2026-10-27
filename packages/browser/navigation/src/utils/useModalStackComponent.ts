import { inject, type Ref } from 'vue';

import ModalStackComponent from '../ModalStackComponent.vue';

export function useModalStackComponent(): Ref<InstanceType<typeof ModalStackComponent> | null> {
    const c = inject('reactive_modalStackComponent') as Ref<InstanceType<typeof ModalStackComponent> | null>;
    return c;
}
