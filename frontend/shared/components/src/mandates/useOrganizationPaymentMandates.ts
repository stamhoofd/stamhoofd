import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { ErrorBox } from '@stamhoofd/components';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequestOwner } from '@stamhoofd/networking';
import { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { reactive, ref, shallowRef } from 'vue';

/**
 * Get available mandates for your organization (current context), to pay at a different organization (B2B)
 */
export function useOrganizationPaymentMandates({
    payingOrganizationId = null,
    sellerOrganizationId, 
    errors
}: {
    payingOrganizationId?: string | null
    sellerOrganizationId: string
    errors: { errorBox: ErrorBox | null };
}) {
    const context = useContext();
    const owner = useRequestOwner()
    const loading = ref(true);
    const mandates = shallowRef<PaymentMandate[] | null>(null)
    const deletingMandates = reactive(new Set<string>());

    // Load on create
    load().catch(console.error)
    
    async function load() {
        try {
            const response = await (payingOrganizationId ? context.value.getAuthenticatedServerForOrganization(payingOrganizationId) : context.value.authenticatedServer).request({
                method: 'GET',
                path: '/billing/'+encodeURIComponent(sellerOrganizationId)+'/mandates',
                shouldRetry: true,
                owner,
                decoder: new ArrayDecoder(PaymentMandate as Decoder<PaymentMandate>) 
            });

            mandates.value = response.data;
        } catch (e) {
            errors.errorBox = new ErrorBox(e)
            mandates.value = []
        }
        loading.value = false;
    }

    async function deleteMandate(mandateId: string) {
        if (deletingMandates.has(mandateId)) {
            return;
        }
        deletingMandates.add(mandateId)

        try {
            await (payingOrganizationId ? context.value.getAuthenticatedServerForOrganization(payingOrganizationId) : context.value.authenticatedServer).request({
                method: 'DELETE',
                path: '/billing/'+encodeURIComponent(sellerOrganizationId)+'/mandates/' + encodeURIComponent(mandateId),
                shouldRetry: false,
                owner,
            });

            if (mandates.value) {
                mandates.value = mandates.value.filter(m => m.id !== mandateId)
            }
        } catch (e) {
            errors.errorBox = new ErrorBox(e)
        } finally {
            deletingMandates.delete(mandateId)
        }
    }

    return {
        loading,
        deleteMandate,
        deletingMandates,
        mandates
    };
}
