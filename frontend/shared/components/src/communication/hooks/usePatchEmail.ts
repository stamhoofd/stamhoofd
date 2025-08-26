import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { Email, EmailPreview } from '@stamhoofd/structures';

export function usePatchEmail() {
    const context = useContext();
    const owner = useRequestOwner();

    async function patchEmail(email: EmailPreview, patch: AutoEncoderPatchType<EmailPreview> | AutoEncoderPatchType<Email>) {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/email/' + email.id,
            body: patch,
            decoder: EmailPreview as Decoder<EmailPreview>,
            owner,
            shouldRetry: false,
        });

        email.deepSet(response.data);
    }

    return { patchEmail };
}
