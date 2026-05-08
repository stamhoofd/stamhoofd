import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { ErrorBox } from '@stamhoofd/components';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequestOwner } from '@stamhoofd/networking';
import { OrganizationMandatesRequest } from '@stamhoofd/structures/checkout/OrganizationMandatesRequest.js';
import { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { ref, shallowRef } from 'vue';

/**
 * Get available mandates for your organization (current context), to pay at a different organization (B2B)
 */
export function useOrganizationPaymentMandates({
    payingOrganizationId = null,
    sellerOrganizationId = null, 
    errors
}: {
    payingOrganizationId?: string | null
    sellerOrganizationId?: string | null
    errors: { errorBox: ErrorBox | null };
}) {
    const context = useContext();
    const owner = useRequestOwner()
    const loading = ref(true);
    const mandates = shallowRef<PaymentMandate[] | null>(null)

    // Load on create
    load().catch(console.error)
    
    async function load() {
        try {
            const response = await (payingOrganizationId ? context.value.getAuthenticatedServerForOrganization(payingOrganizationId) : context.value.authenticatedServer).request({
                method: 'GET',
                path: '/billing/mandates',
                query: OrganizationMandatesRequest.create({
                    sellingOrganizationId: sellerOrganizationId
                }),
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

    return {
        loading,
        mandates
    };
}
