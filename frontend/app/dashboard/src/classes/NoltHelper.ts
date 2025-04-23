import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, Toast } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';

class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    jwt: string;
}

export async function openNolt($context: SessionContext, check = false) {
    if (check) {
        let url: URL | null = null;
        if (document.referrer) {
            try {
                url = new URL(document.referrer);
            }
            catch (e) {
                console.error(e);
            }
        }

        // Request permission if coming from an untrusted domain
        if (!url || (url.hostname !== STAMHOOFD.NOLT_URL && url.hostname !== 'www.stamhoofd.be' && url.hostname !== 'www.stamhoofd.nl')) {
            if (!await CenteredMessage.confirm($t(`1ff9f2e7-bf47-4206-bc03-ec43cfc33b65`), $t(`c4135e6a-2dab-4a8d-810d-252bd5552a22`), $t(`3573c612-1241-4b48-8ed5-8f11b8860e23`, { email: $context.user!.email }), undefined, false)) {
                return;
            }
        }
    }

    // Create token
    const toast = new Toast($t(`ce7d2ca1-bda6-4701-b6a9-3e0cd7ac23c2`), $t(`619a9ba5-895c-4334-a126-a1c4b780e87b`)).setHide(null).show();
    try {
        const response = await $context.authenticatedServer!.request({
            method: 'POST',
            path: '/nolt/create-token',
            decoder: ResponseBody as Decoder<ResponseBody>,
            shouldRetry: false,
        });
        window.location.href = 'https://' + STAMHOOFD.NOLT_URL + '/sso/' + encodeURIComponent(response.data.jwt);
    }
    catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
    toast.hide();
}
