import { AutoEncoder, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useErrors, usePatch } from '@stamhoofd/components';
import { Ref, readonly, ref } from 'vue';

export function useEditPopup<T extends AutoEncoder>({ errors, saveHandler, deleteHandler, toPatch }: { errors: ReturnType<typeof useErrors>; saveHandler: (patch: AutoEncoderPatchType<T>) => Promise<void>; deleteHandler: (() => Promise<void>) | null; toPatch: T | Ref<T> }) {
    const pop = usePop();
    const saving = ref(false);
    const deleting = ref(false);

    const { patched, hasChanges, addPatch, patch } = usePatch(toPatch);

    const save = async () => {
        if (saving.value || deleting.value) {
            return;
        }
        saving.value = true;
        const isValid = await errors.validator.validate();

        if (!isValid) {
            saving.value = false;
            return;
        }

        try {
            await saveHandler(patch.value);
            await pop({ force: true });
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
        saving.value = false;
    };

    const doDelete = async (text: string, confirmText?: string, description?: string) => {
        if (saving.value || deleting.value || !deleteHandler) {
            return;
        }

        if (!await CenteredMessage.confirm(text, confirmText ?? $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), description)) {
            return;
        }

        deleting.value = true;

        try {
            await deleteHandler();
            await pop({ force: true });
        }
        catch (e) {
            Toast.fromError(e).show();
        }

        deleting.value = false;
    };

    const shouldNavigateAway = async () => {
        if (!hasChanges.value) {
            return true;
        }

        return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
    };

    return {
        saving: readonly(saving),
        deleting: readonly(deleting),
        save,
        doDelete,
        shouldNavigateAway,
        hasChanges: readonly(hasChanges),
        patched: patched,
        addPatch,
        patch: readonly(patch),
    };
}
