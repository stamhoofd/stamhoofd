<template>
    <PreviewPanel v-model:wide="previewWide">
        <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" class="webshop-view-page" @save="save">
            <!-- The preview only fits next to the settings on large screens -->
            <template v-if="showPreview && !previewWide" #navigation-buttons>
                <button v-tooltip="$t('%jH')" class="button icon eye" type="button" data-testid="webshop-preview-button" @click="openPreview()" />
            </template>
            <h1>{{ viewTitle }}</h1>
            <STErrorsDefault :error-box="errors.errorBox" />
            <ImageDropArea v-model="coverPhoto" :title="$t('%7M')" :description="$t('Minstens 1600 pixels breed. De foto wordt volledig getoond.')" :resolutions="hs" />
            <STInputBox error-fields="meta.title" :error-box="errors.errorBox" :title="$t(`%vC`)">
                <input v-model="title" class="input" type="text" autocomplete="off" :placeholder="webshop.meta.name">
            </STInputBox>

            <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)">
                <WYSIWYGTextInput v-model="description" :color="color || defaultColor" :placeholder="$t(`%Rc`)" />
            </STInputBox>

            <template v-if="showCrowdfunding">
                <hr>
                <h2>{{ $t('%Zkb') }}</h2>
                <p>{{ $t('%Zkn') }}</p>

                <STList>
                    <CheckboxListItem v-model="enableCrowdfunding" :label="$t('%ZkJ')" />
                    <CheckboxListItem v-if="enableCrowdfunding" v-model="enableGoal" :label="$t('%ZkL')">
                        <PriceInputBox v-if="enableGoal" v-model="goalAmount" :validator="errors.validator" :title="$t('%ZkV')" :min="0" />
                    </CheckboxListItem>
                </STList>
            </template>

            <hr>
            <h2>
                {{ $t('%2A') }}
                <span class="style-tag gray"><span class="icon laptop tiny" /><span>{{ $t('Enkel op laptop') }}</span></span>
            </h2>

            <STList>
                <!-- Not centered once the title input below the description is shown -->
                <STListItem :selectable="true" element-name="label" :class="{ 'left-center': layout !== WebshopLayout.Split }">
                    <template #left>
                        <Radio v-model="layout" :value="WebshopLayout.Split" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%RI') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('%RJ') }}
                    </p>
                    <STInputBox v-if="layout === WebshopLayout.Split" error-fields="meta.orderTitle" :error-box="errors.errorBox" :title="$t('Titel rechterpaneel')">
                        <input v-model="orderTitle" class="input" type="text" autocomplete="off" :placeholder="defaultOrderTitle">
                    </STInputBox>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="layout" :value="WebshopLayout.Default" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%RK') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('%RL') }}
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>{{ $t('%RR') }}</h2>
            <p>
                {{ $t('%RS') }}
            </p>

            <ColorInput v-model="color" :validator="errors.validator" :required="false" :disallowed="['#FFFFFF']" :title="$t(`%OQ`)" :placeholder="$t(`%Rd`)" />
            <p class="style-description-small">
                {{ $t('%RT') }}
            </p>

            <STInputBox error-fields="meta.darkMode" :error-box="errors.errorBox" class="max" :title="$t(`%Re`)">
                <RadioGroup>
                    <Radio v-model="darkMode" :value="'Off'">
                        {{ $t('%RU') }}
                    </Radio>
                    <Radio v-model="darkMode" :value="'On'">
                        {{ $t('%RV') }}
                    </Radio>
                    <Radio v-model="darkMode" :value="'Auto'">
                        {{ $t('%RW') }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
            <p v-if="darkMode !== 'Off'" class="style-description-small">
                {{ $t('%RX') }}
            </p>

            <hr>
            <h2>{{ $t('%2D') }}</h2>
            <p>
                {{ $t('%RY') }}
            </p>

            <Checkbox v-model="useLogo">
                {{ $t('%RZ') }}
            </Checkbox>

            <LogoEditor v-if="!useLogo" :meta-data="webshop.meta" :validator="errors.validator" :dark-mode="darkMode" @patch="addMetaPatch" />

            <template v-if="hasTickets">
                <hr>
                <EditSponsorsBox :config="sponsorConfig" @patch="patchSponsorConfig" />

                <p class="style-button-bar">
                    <button type="button" class="button text" @click="previewTicket">
                        <span class="icon eye" /><span>{{ $t('%Ra') }}</span>
                    </button>
                </p>
            </template>

            <hr>
            <h2 class="style-with-button">
                <div>{{ $t('%RN') }}</div>
                <div>
                    <button type="button" class="button icon add" @click="addPolicy" />
                </div>
            </h2>
            <p>{{ $t('%RO') }}</p>

            <p v-if="policies.length === 0" class="info-box">
                {{ $t('%RP') }}
            </p>
            <p v-if="policies.length > 0 && (organization?.meta.privacyPolicyFile || organization?.meta.privacyPolicyUrl)" class="warning-box">
                {{ $t('%RQ') }}
            </p>

            <STList v-if="policies.length > 0" v-model="draggablePolicies" :draggable="true">
                <template #item="{ item: policy }">
                    <STListItem v-long-press="(e: TouchEvent | MouseEvent) => showPolicyContextMenu(policy, e)" :selectable="true" class="right-stack" @click="editPolicy(policy)" @contextmenu.prevent="showPolicyContextMenu(policy, $event)">
                        <h3 class="style-title-list">
                            {{ policy.name || $t('%CL') }}
                        </h3>
                        <p v-if="policy.url || policy.file?.name" class="style-description-small">
                            {{ policy.url || policy.file?.name }}
                        </p>

                        <template #right>
                            <span class="button icon drag gray" @click.stop @contextmenu.stop />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </template>
            </STList>

            <hr>
            <h2>{{ $t('%14T') }}</h2>
            <STInputBox error-fields="meta.defaultLanguage" :error-box="errors.errorBox">
                <Dropdown v-model="defaultLanguage">
                    <option :value="null">
                        {{
                            $organization.language
                                ? ($t('%Znr') + ' ('+LanguageHelper.getNativeName($organization.language) + ')')
                                : $t('%Zns')
                        }}
                    </option>
                    <option v-for="language in languages" :key="language" :value="language">
                        {{ LanguageHelper.getNativeName(language) }}
                    </option>
                </Dropdown>
            </STInputBox>

            <template v-if="STAMHOOFD.platformName === 'stamhoofd'">
                <hr>
                <h2>{{ $t("%q") }}</h2>
                <p>
                    {{ $t('%46') }}
                </p>

                <Checkbox v-model="reduceBranding">
                    {{ $t('%47') }}
                </Checkbox>
            </template>

            <div v-if="hasFullAccess && areAdvancedWebshopSettingsEnabled" class="container">
                <hr>
                <h2>{{ $t('%15t') }}</h2>
                <p v-if="!hasCustomDomain" class="info-box">
                    {{ $t('%15s') }}
                </p>
                <STInputBox error-fields="meta.customCode" :error-box="errors.errorBox" class="max">
                    <textarea v-model="customCode" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t('%15u')" :disabled="!hasCustomDomain" />
                </STInputBox>
                <p class="style-description-small">
                    {{ $t('%Zfc') }}
                </p>
            </div>
        </SaveView>

        <template v-if="showPreview" #preview>
            <WebshopPreviewCard v-model:device="previewDevice" :webshop="webshop" />
        </template>
    </PreviewPanel>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@common/encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { getProductListTitle } from '@stamhoofd/components/helpers/webshopWording.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import CheckboxListItem from '@stamhoofd/components/inputs/CheckboxListItem.vue';
import ColorInput from '@stamhoofd/components/inputs/ColorInput.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import ImageDropArea from '@stamhoofd/components/inputs/ImageDropArea.vue';
import PriceInputBox from '@stamhoofd/components/inputs/PriceInputBox.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import RadioGroup from '@stamhoofd/components/inputs/RadioGroup.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import WYSIWYGTextInput from '@stamhoofd/components/inputs/WYSIWYGTextInput.vue';
import PreviewPanel from '@stamhoofd/components/layout/PreviewPanel.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components/overlays/ContextMenu.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';

import LogoEditor from '@stamhoofd/components/views/LogoEditor.vue';
import type { DarkMode, Image, RichText, SponsorConfig } from '@stamhoofd/structures';
import { Cart, CartItem, CartReservedSeat, LanguageHelper, Policy, PrivateWebshop, ProductType, ResolutionRequest, TicketPublic, WebshopCrowdfunding, WebshopLayout, WebshopMetaData, WebshopOrderMode, WebshopType } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';

import { computed, ref } from 'vue';
import EditSponsorsBox from '../../sponsors/EditSponsorsBox.vue';
import type { UseEditWebshopProps } from './useEditWebshop';
import { useEditWebshop } from './useEditWebshop';
import { useWebshopPreview } from './useWebshopPreview';
import WebshopPreviewCard from './WebshopPreviewCard.vue';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway, originalWebshop } = useEditWebshop({
    getProps: () => props,
});
const present = usePresent();
const organization = useOrganization();
const { showPreview, openPreview } = useWebshopPreview(webshop);
const previewWide = ref(false);
const previewDevice = ref<'laptop' | 'smartphone'>('smartphone');
const viewTitle = $t('%Zp4');
const auth = useAuth();
const hasFullAccess = computed(() => auth.permissions?.hasFullAccess() ?? false);

const areAdvancedWebshopSettingsEnabled = useFeatureFlag()('webshop-advanced-settings');

const hasTickets = computed(() => webshop.value.hasTickets);

const hasCustomDomain = computed(() => webshop.value.hasCustomDomain || STAMHOOFD.environment === 'development');

function addMetaPatch(patch: AutoEncoderPatchType<WebshopMetaData>) {
    addPatch(PrivateWebshop.patch({ meta: patch }));
}

function addPolicy() {
    const policy = Policy.create({});
    present({
        components: [
            AsyncComponent(() => import('./EditPolicyView.vue'), {
                policy,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<Policy>) => {
                    const p = WebshopMetaData.patch({});
                    p.policies.addPut(policy.patch(patch));
                    addMetaPatch(p);
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

function editPolicy(policy: Policy) {
    present({
        components: [
            AsyncComponent(() => import('./EditPolicyView.vue'), {
                policy,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<Policy>) => {
                    const p = WebshopMetaData.patch({});
                    patch.id = policy.id;
                    p.policies.addPatch(patch);
                    addMetaPatch(p);
                },
                deleteHandler: () => deletePolicy(policy),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

function deletePolicy(policy: Policy) {
    const p = WebshopMetaData.patch({});
    p.policies.addDelete(policy.id);
    addMetaPatch(p);
}

// Moves the link after the given link, or to the top when null
function movePolicy(policy: Policy, after: Policy | null) {
    const p = WebshopMetaData.patch({});
    p.policies.addMove(policy.id, after?.id ?? null);
    addMetaPatch(p);
}

const draggablePolicies = computed({
    get: () => policies.value,
    set: (value: Policy[]) => {
        if (value.length !== policies.value.length) {
            return;
        }
        const p = WebshopMetaData.patch({});
        for (const policy of value.slice().reverse()) {
            p.policies.addMove(policy.id, null);
        }
        addMetaPatch(p);
    },
});

function showPolicyContextMenu(policy: Policy, event: TouchEvent | MouseEvent | undefined) {
    const index = policies.value.findIndex(p => p.id === policy.id);
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%11f'),
                icon: 'arrow-up',
                disabled: index <= 0,
                action: () => {
                    movePolicy(policy, policies.value[index - 2] ?? null);
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t('%11g'),
                icon: 'arrow-down',
                disabled: index >= policies.value.length - 1,
                action: () => {
                    movePolicy(policy, policies.value[index + 1]);
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t('%CJ'),
                destructive: true,
                icon: 'trash',
                action: () => {
                    confirmDeletePolicy(policy).catch(console.error);
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

async function confirmDeletePolicy(policy: Policy) {
    if (!await CenteredMessage.confirm({
        title: policy.name ? $t('%Zn2', { name: policy.name }) : $t('Deze link verwijderen?'),
        confirmText: $t('%CJ'),
        description: $t('De link wordt pas echt verwijderd als je verder gaat en alle wijzigingen opslaat.'),
        availabilityDelay: 2_000,
    })) {
        return;
    }
    deletePolicy(policy);
}

// Also shown for other webshop types that already have crowdfunding enabled, so it can be turned off again
const showCrowdfunding = computed(() => webshop.value.meta.type === WebshopType.Donations || originalWebshop.meta.crowdfunding !== null);

const enableCrowdfunding = computed({
    get: () => webshop.value.meta.crowdfunding !== null,
    set: (enableCrowdfunding: boolean) => {
        if (enableCrowdfunding === (webshop.value.meta.crowdfunding !== null)) {
            return;
        }
        const patch = WebshopMetaData.patch({
            crowdfunding: enableCrowdfunding ? (originalWebshop.meta.crowdfunding ?? WebshopCrowdfunding.create({})) : null,
        });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const enableGoal = computed({
    get: () => webshop.value.meta.crowdfunding?.goalAmount !== null,
    set: (enableGoal: boolean) => {
        const patch = WebshopMetaData.patch({
            crowdfunding: WebshopCrowdfunding.patch({
                goalAmount: enableGoal ? (originalWebshop.meta.crowdfunding?.goalAmount ?? 0) : null,
            }),
        });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const goalAmount = computed({
    get: () => webshop.value.meta.crowdfunding?.goalAmount ?? 0,
    set: (goalAmount: number) => {
        const patch = WebshopMetaData.patch({
            crowdfunding: WebshopCrowdfunding.patch({
                goalAmount: goalAmount,
            }),
        });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const policies = computed(() => webshop.value.meta.policies);
const title = computed({
    get: () => webshop.value.meta.title,
    set: (title: string) => {
        const patch = WebshopMetaData.patch({ title });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const description = computed({
    get: () => webshop.value.meta.description,
    set: (description: RichText) => {
        const patch = WebshopMetaData.patch({ description });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const reduceBranding = computed({
    get: () => webshop.value.meta.reduceBranding,
    set: (reduceBranding: boolean) => {
        const patch = WebshopMetaData.patch({ reduceBranding });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const layout = computed({
    get: () => webshop.value.meta.layout,
    set: (layout: WebshopLayout) => {
        const patch = WebshopMetaData.patch({ layout });
        addPatch(PrivateWebshop.patch({ meta: patch }));

        // The layout only differs on large screens
        previewDevice.value = 'laptop';
    },
});

const orderTitle = computed({
    get: () => webshop.value.meta.orderTitle,
    set: (orderTitle: string) => {
        const patch = WebshopMetaData.patch({ orderTitle });
        addPatch(PrivateWebshop.patch({ meta: patch }));

        // Only shown next to the content on large screens
        previewDevice.value = 'laptop';
    },
});

// Same default as the webshop: the name of the product when its form is shown on the page
const defaultOrderTitle = computed(() => {
    if (webshop.value.meta.orderMode === WebshopOrderMode.Single && webshop.value.products.length === 1) {
        return webshop.value.products[0].name;
    }
    return getProductListTitle(webshop.value);
});

const languages = Object.values(Language);

const defaultLanguage = computed({
    get: () => webshop.value.meta.defaultLanguage,
    set: (defaultLanguage: Language) => {
        const patch = WebshopMetaData.patch({ defaultLanguage });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const color = computed({
    get: () => webshop.value.meta.color,
    set: (color: string | null) => {
        const patch = WebshopMetaData.patch({ color });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const darkMode = computed({
    get: () => webshop.value.meta.darkMode,
    set: (darkMode: DarkMode) => {
        const patch = WebshopMetaData.patch({ darkMode });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const useLogo = computed({
    get: () => !webshop.value.meta.useLogo,
    set: (useLogo: boolean) => {
        addMetaPatch(WebshopMetaData.patch({ useLogo: !useLogo }));
    },
});

const defaultColor = computed(() => organization.value?.meta.color ?? null);

const coverPhoto = computed({
    get: () => webshop.value.meta.coverPhoto,
    set: (coverPhoto: Image | null) => {
        const patch = WebshopMetaData.patch({ coverPhoto });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const customCode = computed({
    get: () => webshop.value.meta.customCode ?? '',
    set: (customCode: string) => {
        const patch = WebshopMetaData.patch({ customCode });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const hs = [
    ResolutionRequest.create({
        width: 1800,
    }),
    ResolutionRequest.create({
        width: 900,
    }),
];

const sponsorConfig = computed(() => webshop.value.meta.sponsors);

function patchSponsorConfig(config: AutoEncoderPatchType<SponsorConfig> | null) {
    addMetaPatch(WebshopMetaData.patch({ sponsors: config }));
}

function previewTicket() {
    // Example product:
    const product = webshop.value.products.find(p => p.type === ProductType.Ticket) ?? webshop.value.products[0];

    if (!product) {
        new Toast($t('%ZoI'), 'error red').show();
        return;
    }
    const cart = Cart.create({});
    const item = CartItem.createDefault(product, cart, webshop.value, { admin: true });

    const seatingPlan = product.seatingPlanId ? webshop.value.meta.seatingPlans.find(s => s.id === product.seatingPlanId) : null;
    const section = seatingPlan ? seatingPlan.sections[0] : null;
    const row = section ? section.rows.filter(r => r.label && r.seatCount > 0)[Math.floor(section.rows.filter(r => r.label && r.seatCount > 0).length / 2)] : null;
    const seat = row ? row.seats.filter(s => s.isValidSeat)[Math.floor(row.seats.filter(s => s.isValidSeat).length / 2)] : null;

    const reservedSeat = seat
        ? CartReservedSeat.create({
                section: section!.id,
                row: row!.label,
                seat: seat.label,
            })
        : null;

    if (reservedSeat && seatingPlan) {
        reservedSeat.calculatePrice(seatingPlan);
    }

    const ticket = TicketPublic.create({
        items: [item],
        secret: 'VRBLDTICKET',
        index: 1,
        total: 1,
        seat: reservedSeat,
    });

    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('@stamhoofd/components/views/DetailedTicketView.vue'), {
                    organization: organization.value,
                    webshop: webshop.value,
                    ticket,
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.webshop-view-page {
    .image {
        display: block;
        max-width: 100%;
        max-height: 200px;
        width: auto;
        height: auto;
    }

}
</style>
