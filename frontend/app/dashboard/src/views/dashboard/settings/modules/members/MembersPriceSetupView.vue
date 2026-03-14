<!-- <template>
    <div id="personalize-settings-view" class="st-view background">
        <STNavigationBar title="Lidgeld" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>Standaard inschrijvingsgeld</h1>
            <p>Je kan later nog de prijs per inschrijvingsgroep wijzigen, maar deze prijs zal automatisch ingesteld worden als je nieuwe inschrijvingsgroepen maakt.</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <GroupPriceBox :period="patchedPeriod" :price="patchedGroup.settings.prices[0]" :group="patchedGroup" :errors="errors" :default-membership-type-id="defaultMembershipTypeId" :validator="errors.validator" :external-organization="externalOrganization" @patch:period="addPatch" @patch:price="addPricePatch" />
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useCanDismiss, useCanPop, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, LoadingButton, STErrorsDefault, STNavigationBar, STToolbar, Toast, useContext, useErrors, usePatch, useRequiredOrganization } from '@stamhoofd/components';
import { OrganizationMetaData, PaymentMethod, STPackageBundle } from '@stamhoofd/structures';

import { useOrganizationManager } from '@stamhoofd/networking';
import { OldGroupPrices } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import ActivatedView from './ActivatedView.vue';
import {GroupPriceBox} from '@stamhoofd/components';

const errors = useErrors();
const saving = ref(false);
const show = useShow();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const organizationManager = useOrganizationManager();
const context = useContext();
const navigationController = useNavigationController();

const requiredOrganization = useRequiredOrganization();
const { patch: organizationPatch, patched: patchedOrganization, hasChanges, addPatch: addOrganizationPatch, reset: resetOrganizationPatch } = usePatch(requiredOrganization.value);

function addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>>) {
    addOrganizationPatch({ meta: OrganizationMetaData.patch(patch) });
}

const prices = computed(() => patchedOrganization.value.meta.defaultPrices);

// todo: OldGroupPrices deprecated
function addPricesPatch(patch: PatchableArrayAutoEncoder<OldGroupPrices>) {
    addMetaPatch({ defaultPrices: patch });
}

async function checkout(bundle: STPackageBundle) {
    // todo
    await context.value.authenticatedServer.request({
        method: 'POST',
        path: '/billing/activate-packages',
        body: {
            bundles: [bundle],
            paymentMethod: PaymentMethod.Unknown,
        },
    });
    await context.value.fetchOrganization();
}

async function save() {
    if (saving.value) {
        return;
    }

    const simpleErrors = new SimpleErrors();

    let valid = false;

    if (simpleErrors.errors.length > 0) {
        errors.errorBox = new ErrorBox(errors);
    }
    else {
        errors.errorBox = null;
        valid = true;
    }
    valid = valid && await errors.validator.validate();

    if (!valid) {
        return;
    }

    saving.value = true;

    try {
        await organizationManager.value.patch(organizationPatch.value);
        await checkout(STPackageBundle.TrialMembers);
        // todo: test is this necesary?
        resetOrganizationPatch();

        new Toast('Je kan nu de ledenadministratie uittesten', 'success green').show();

        show({
            components: [new ComponentWithProperties(ActivatedView)],
            replace: navigationController.value.components.length,
            force: true,
        }).catch(console.error);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script> -->
