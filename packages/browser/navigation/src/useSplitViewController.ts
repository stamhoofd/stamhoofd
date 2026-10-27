import { inject, shallowRef, type Ref } from 'vue';
import type SplitViewController from './SplitViewController.vue';

export function useSplitViewController(): Ref<InstanceType<typeof SplitViewController>> {
    const c = inject('reactive_splitViewController') as InstanceType<typeof SplitViewController> | Ref<InstanceType<typeof SplitViewController>>;
    return shallowRef(c);
}
