import type { InjectionKey, Ref } from 'vue';

/** Header element of the enclosing CategorizedBox, provided so nested components can render buttons into it */
export const categorizedBoxButtonsTarget: InjectionKey<Ref<HTMLElement | null>> = Symbol('categorizedBoxButtonsTarget');
