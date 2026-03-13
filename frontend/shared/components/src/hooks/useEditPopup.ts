import { AutoEncoder, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { Toast } from '#overlays/Toast.ts';
import { useErrors } from '#errors/useErrors.ts';
import { usePatch } from '#hooks/usePatch.ts';
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

        if (!await CenteredMessage.confirm(text, confirmText ?? $t('%55'), description)) {
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

        return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
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
