import { ErrorBox } from '#errors/ErrorBox';
import { useContext } from '#hooks/useContext.ts';
import { Toast } from '#overlays/Toast';
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, deepSetArray, PatchableArray } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';
import { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { reactive, ref } from 'vue';
import { useGlobalEventListener } from '../hooks/useGlobalEventListener';

/**
 * Get available mandates for your organization (current context), to pay at a different organization (B2B)
 */
export function useOrganizationPaymentMandates({
    payingOrganizationId = null,
    sellingOrganizationId, 
    errors
}: {
    payingOrganizationId?: string | null
    sellingOrganizationId: string
    errors: { errorBox: ErrorBox | null };
}) {
    const context = useContext();
    const owner = useRequestOwner()
    const loading = ref(true);
    const mandates = ref<PaymentMandate[] | null>(null)
    const updatingMandates = reactive(new Set<string>());

    // Reload after payment succeeded (mandates might have changed)
    useGlobalEventListener('payment-succeeded', async () => {
        load().catch(console.error)
    })

    // Load on create
    load().catch(console.error)
    
    async function load() {
        try {
            const response = await (payingOrganizationId ? context.value.getAuthenticatedServerForOrganization(payingOrganizationId) : context.value.authenticatedServer).request({
                method: 'GET',
                path: '/billing/'+encodeURIComponent(sellingOrganizationId)+'/mandates',
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
        if (updatingMandates.has(mandateId)) {
            return;
        }
        updatingMandates.add(mandateId)

        try {
            await (payingOrganizationId ? context.value.getAuthenticatedServerForOrganization(payingOrganizationId) : context.value.authenticatedServer).request({
                method: 'DELETE',
                path: '/billing/'+encodeURIComponent(sellingOrganizationId)+'/mandates/' + encodeURIComponent(mandateId),
                shouldRetry: false,
                owner,
            });

            if (mandates.value) {
                mandates.value = mandates.value.filter(m => m.id !== mandateId)
            }

            Toast.success($t('De bankkaart werd verwijderd')).show()
        } catch (e) {
            Toast.fromError(e).show()
        } finally {
            updatingMandates.delete(mandateId)
        }
    }

    async function setDefaultMandate(mandateId: string) {
        if (updatingMandates.has(mandateId)) {
            return;
        }
        updatingMandates.add(mandateId)

        try {
            const arr = new PatchableArray();
            arr.addPatch(PaymentMandate.patch({
                id: mandateId,
                isDefault: true
            }))

            const response = await (payingOrganizationId ? context.value.getAuthenticatedServerForOrganization(payingOrganizationId) : context.value.authenticatedServer).request({
                method: 'PATCH',
                path: '/billing/'+encodeURIComponent(sellingOrganizationId)+'/mandates',
                body: arr,
                shouldRetry: false,
                owner,
                decoder: new ArrayDecoder(PaymentMandate as Decoder<PaymentMandate>) 
            });

            if (mandates.value) {
                deepSetArray(mandates.value, response.data, {keepMissing: false})
            } else {
                mandates.value = response.data;
            }

            Toast.success($t('Standaard bankkaart gewijzigd')).show()
        } catch (e) {
            Toast.fromError(e).show()
        } finally {
            updatingMandates.delete(mandateId)
        }
    }

    return {
        loading,
        deleteMandate,
        setDefaultMandate,
        updatingMandates,
        mandates
    };
}
