import { computed, Ref, unref } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';

export interface QuickAction {
    illustration?: string;
    leftComponent?: any;
    leftProps?: any;
    title: string;
    description: string;
    rightText?: string;
    rightTextClass?: string;
    action: () => Promise<void> | void;
}

export interface QuickActions {
    actions: Ref<QuickAction[]> | QuickAction[];
    loading: Ref<boolean> | boolean;
    errorBox?: Ref<ErrorBox | null | undefined> | ErrorBox | null | undefined;
}

export function useMergedQuickActions(...actions: QuickActions[]): QuickActions {
    return {
        actions: computed(() => actions.flatMap(a => unref(a.actions))),
        loading: computed(() => actions.some(a => unref(a.loading))),
        errorBox: computed(() => {
            return mergeErrorBox(...actions.map(a => unref(a.errorBox)));
        }),
    };
}

export function mergeErrorBox(...errorBoxes: (ErrorBox | null | undefined)[]): ErrorBox | null {
    const errors = errorBoxes.filter(e => !!e).flatMap(e => e.errors);

    if (errors.length > 0) {
        return new ErrorBox(errors);
    }
    return null;
}
