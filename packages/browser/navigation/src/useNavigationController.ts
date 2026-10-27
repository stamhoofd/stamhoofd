import { type Ref, inject, shallowRef } from 'vue';
import type NavigationController from './NavigationController.vue';

export function useNavigationController(): Ref<InstanceType<typeof NavigationController>> {
    const c = inject('reactive_navigationController') as InstanceType<typeof NavigationController> | Ref<InstanceType<typeof NavigationController>>;
    return shallowRef(c);
}
