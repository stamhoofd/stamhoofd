<template>
    <div class="container" data-testid="tax-certificate-box">
        <Title v-bind="$attrs" :title="$t('Fiscale attesten')">
            <template v-if="isAdmin && isFullAdmin && (member.needsTaxCertificateIfSevereDisability || severeDisability)" #right>
                <SevereDisabilityToggle v-model="severeDisability" :member="member" />
            </template>
        </Title>

        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />
        <MemberNRRInput v-if="isPropertyEnabled('nationalRegisterNumber')" :member="member" :validator="validator" />

        <template v-if="member.needsTaxCertificate && member.patchedMember.details.nationalRegisterNumber !== NationalRegisterNumberOptOut">
            <STInputBox v-if="coParenting || parents.length > 1" :title="$t('Gescheiden ouders met co-ouderschap')" class="max" error-fields="coParenting" :error-box="errors.errorBox" :parent-error-box="parentErrorBox">
                <STList>
                    <STListItem :selectable="true" element-name="label" class="right-stack left-center" data-testid="co-parenting-row">
                        <template #left>
                            <Checkbox v-model="coParenting" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('Twee aparte fiscale attesten opmaken voor de helft van het bedrag') }}
                        </h3>
                        <p class="style-description-small">
                            <I18nComponent :t="$t('Enkel mogelijk als beide ouders {firstName} ten laste hebben, gescheiden zijn, fiscaal co-ouderschap hebben én de kostprijs voor inschrijvingen delen. <button>Meer info</button>', {firstName: member.patchedMember.details.firstName})">
                                <template #button="{content}">
                                    <a class="inline-link" href="https://fin.belgium.be/nl/particulieren/belastingaangifte/persoonlijke-situatie/personen-ten-laste/kinderen" target="_blank">
                                        {{ content }}
                                    </a>
                                </template>
                            </I18nComponent>
                        </p>
                    </STListItem>
                </STList>
            </STInputBox>

            <STInputBox :title="parents.length === 1 ? $t('Rijksregisternummer {firstName} (schuldenaar)', {firstName: parents[0].firstName}) : (coParenting ? $t('Rijksregisternummer co-ouders (schuldenaars)') : $t('Rijksregisternummer schuldenaar (ouder)'))" class="max" error-fields="debtor" :error-box="errors.errorBox" :parent-error-box="parentErrorBox">
                <p v-if="parents.length > 1 && !coParenting" class="style-description-small">
                    {{ $t('Kies één ouder die het inschrijvingsbedrag betaalt en op de fiscale attesten vermeld wordt. Kies bij voorkeur het gezinshoofd of de ouder die {firstName} ten laste heeft.', {firstName: member.patchedMember.details.firstName}) }}
                </p>
                <STList>
                    <STListItem v-for="parent in parents" :key="parent.id" :selectable="true" element-name="label" class="right-stack left-center" data-testid="debtor-row">
                        <template v-if="parents.length > 1 && !(coParenting && parents.length === 2)" #left>
                            <Checkbox v-if="coParenting" :model-value="isParentSelected(parent)" @update:model-value="setParentSelected(parent, $event)" />
                            <Radio v-else :model-value="isParentSelected(parent)" :value="true" name="schuldenaar" @update:model-value="setParentSelected(parent, $event)" />
                        </template>

                        <h3 class="style-title-list">
                            {{ parent.firstName }} {{ parent.lastName }}
                        </h3>
                        <p v-if="parent.address" class="style-description-small">
                            {{ parent.address }}
                        </p>

                        <div v-if="isParentSelected(parent)">
                            <NRNInput :model-value="getParentNRN(parent)" title="" :placeholder="$t('Rijksregisternummer van {firstName}', {firstName: parent.firstName})" :required="isPropertyRequired('parents.nationalRegisterNumber')" :validator="errors.validator" data-testid="debtor-nrn-input" @update:model-value="setParentNRN(parent, $event)" />
                        </div>
                    </STListItem>
                </STList>
            </STInputBox>
        </template>

        <p v-if="!willMarkReviewed && reviewDate && isAdmin" class="style-description-small">
            {{ $t('Gegevens voor fiscale attesten laatst nagekeken op {date}', {date: formatDate(reviewDate)}) }}. <button v-tooltip="$t('%fD')" type="button" class="inline-link" @click="clear">
                {{ $t('%fE') }}
            </button>.
        </p>
        <p v-if="!willMarkReviewed && !reviewDate && isAdmin && !member.isNew" class="style-description-small">
            {{ $t('Gegevens voor fiscale attesten nog nooit nagekeken.') }} <button v-if="canMarkReviewed" class="inline-link" type="button" @click="doMarkReviewed">
                {{ $t('%jC') }}
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import type { PlatformMember } from '@stamhoofd/structures';
import { BooleanStatus, Parent, ParentType } from '@stamhoofd/structures';

import { useAppContext } from '#context/appContext.ts';
import { NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import type { ErrorBox } from '../../../errors/ErrorBox';
import type { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';

import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useValidation } from '#errors/useValidation.ts';
import { useAuth } from '#hooks/useAuth.ts';
import NRNInput from '#inputs/NRNInput.vue';
import Radio from '#inputs/Radio.vue';
import STInputBox from '#inputs/STInputBox.vue';
import STList from '#layout/STList.vue';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePresent } from '@simonbackx/vue-app-navigation';
import MemberNRRInput from './MemberNRRInput.vue';
import SevereDisabilityToggle from './SevereDisabilityToggle.vue';
import Title from './Title.vue';
import { useIsPropertyEnabled, useIsPropertyRequired } from '#members/hooks/useIsPropertyRequired.ts';

defineOptions({
    inheritAttrs: false,
});
const props = defineProps<{
    member: PlatformMember;
    validator: Validator;
    parentErrorBox?: ErrorBox | null;
    willMarkReviewed?: boolean;
}>();

const errors = useErrors({ validator: props.validator });
const auth = useAuth();

const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const isFullAdmin = auth.hasFullAccess();
const parents = computed(() => props.member.patchedMember.details.parents);
const reviewDate = computed(() => {
    return props.member.patchedMember.details.reviewTimes.getLastReview('taxCertificates');
});
const now = new Date();
const canMarkReviewed = computed(() => !reviewDate.value || reviewDate.value < now || reviewDate.value);
const isPropertyRequired = useIsPropertyRequired(computed(() => props.member));
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true);

onMounted(() => {
    if (parents.value.length === 1 && !isAdmin) {
        setParentSelected(parents.value[0], true);
    }
});

const preferredParents = computed(() => {
    return parents.value.filter(p => p.type === ParentType.Father || p.type === ParentType.Mother || p.type === ParentType.Parent1 || p.type === ParentType.Parent2 || p.type === ParentType.Other);
});

const cachedCoParenting = ref(false);

const coParenting = computed({
    get: () => {
        return parents.value.filter(p => p.isMemberTaxDependent).length > 1 || cachedCoParenting.value;
    },
    set: (enabled: boolean) => {
        cachedCoParenting.value = enabled;
        if (enabled) {
            let c = parents.value.filter(p => p.isMemberTaxDependent).length;
            for (const parent of [...preferredParents.value, ...parents.value]) {
                if (c >= 2) {
                    break;
                }
                if (!parent.isMemberTaxDependent) {
                    props.member.patchParent(Parent.patch({
                        id: parent.id,
                        isMemberTaxDependent: true,
                    }));
                    c += 1;
                }
            }
            return;
        }

        for (const parent of parents.value.filter(p => p.isMemberTaxDependent).slice(1)) {
            props.member.patchParent(Parent.patch({
                id: parent.id,
                isMemberTaxDependent: false,
            }));
        }
    },
});

useValidation(props.validator, () => {
    if (props.member.patchedMember.details.nationalRegisterNumber === NationalRegisterNumberOptOut) {
        if (parents.value.filter(p => p.isMemberTaxDependent).length > 0) {
            for (const parent of parents.value) {
                props.member.patchParent(Parent.patch({
                    id: parent.id,
                    isMemberTaxDependent: false,
                }));
            }
        }
        return;
    }
    if (parents.value.filter(p => p.isMemberTaxDependent).length === 0 && !isAdmin) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'debtor',
            message: $t('Kies één schuldenaar'),
        });
    }

    if (parents.value.filter(p => p.isMemberTaxDependent).length > 2) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'debtor',
            message: $t('Je kan maximaal twee ouders aanduiden als schuldenaar'),
        });
    }

    if (coParenting.value && parents.value.filter(p => p.isMemberTaxDependent).length !== 2) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'debtor',
            message: $t('Kies twee schuldenaars of schakel het splitsen van het fiscale attest uit'),
        });
    }

    for (const parent of parents.value) {
        if (parent.isMemberTaxDependent) {
            if (!parent.nationalRegisterNumber) {
                continue;
            }

            if (parent.nationalRegisterNumber === props.member.patchedMember.details.nationalRegisterNumber) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'debtor',
                    message: $t('Het rijksregisternummer van een ouder kan niet gelijk zijn aan dat van het lid zelf'),
                });
            }

            if (parents.value.find(p => p.id !== parent.id && p.isMemberTaxDependent && p.nationalRegisterNumber === parent.nationalRegisterNumber)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'debtor',
                    message: $t('Het rijksregisternummer van een ouder kan niet gelijk zijn aan dat van een andere ouder'),
                });
            }
        }
    }
});

const severeDisability = computed({
    get: () => props.member.patchedMember.details.severeDisability?.value ?? false,
    set: severeDisability => props.member.addDetailsPatch({ severeDisability:
        BooleanStatus.create({
            value: severeDisability,
        }),
    }),
});

function isParentSelected(parent: Parent) {
    return parent.isMemberTaxDependent;
}
function setParentSelected(parent: Parent, selected: boolean) {
    if (selected === isParentSelected(parent)) {
        return;
    }
    if (coParenting.value) {
        props.member.patchParent(Parent.patch({
            id: parent.id,
            isMemberTaxDependent: !parent.isMemberTaxDependent,
        }));
    } else {
        for (const parent of parents.value) {
            props.member.patchParent(Parent.patch({
                id: parent.id,
                isMemberTaxDependent: false,
            }));
        }
        props.member.patchParent(Parent.patch({
            id: parent.id,
            isMemberTaxDependent: !parent.isMemberTaxDependent,
        }));
    }
}

function getParentNRN(parent: Parent) {
    return parent.nationalRegisterNumber;
}
function setParentNRN(parent: Parent, nationalRegisterNumber: string | null | typeof NationalRegisterNumberOptOut) {
    if (nationalRegisterNumber === getParentNRN(parent)) {
        return;
    }
    props.member.patchParent(Parent.patch({
        id: parent.id,
        nationalRegisterNumber: nationalRegisterNumber || null,
    }));
}

const present = usePresent();

async function editParent(parent: Parent) {
    await present({
        components: [
            AsyncComponent(() => import('./EditParentView.vue'), {
                member: props.member,
                parent,
                isNew: false,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function clear() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.removeReview('taxCertificates');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}

function doMarkReviewed() {
    const times = props.member.patchedMember.details.reviewTimes.clone();
    times.markReviewed('taxCertificates');
    props.member.addDetailsPatch({
        reviewTimes: times,
    });
}

</script>
