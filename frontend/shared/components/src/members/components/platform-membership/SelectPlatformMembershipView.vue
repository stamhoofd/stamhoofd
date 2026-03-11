<template>
    <SaveView :title="title" :loading="loading" :save-text="saveText" :disabled="!selectedOrganization" @save="save">
        <h1>{{ title }}</h1>

        <p v-if="availableOrganizations.length === 0" class="warning-box">
            {{ $t('%3x') }}
        </p>
        <p v-if="availableMembershipTypes.length === 0" class="warning-box">
            {{ $t('%8w') }}
        </p>

        <template v-else>
            <ScrollableSegmentedControl v-if="availableOrganizations.length > 1" v-model="selectedOrganization" :items="availableOrganizations" :labels="availableOrganizations.map(o => o.name)" />

            <template v-if="selectedOrganization.id !== platform.membershipOrganizationId">
                <p v-if="organization" class="style-description-block">
                    {{ $t('%3v') }}
                </p>
                <p v-else class="style-description-block">
                    {{ $t('%7i', {name: selectedOrganization.name }) }}
                </p>
            </template>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList>
                <STListItem v-for="type of availableMembershipTypes" :key="type.id" :disabled="!getTypeAvailable(type)" :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="selectedMembershipType" :value="type" :disabled="!getTypeAvailable(type)" />
                    </template>
                    <h2 class="style-title-list">
                        {{ type.name }}
                    </h2>
                    <p v-if="getTypeDateDescription(type) " class="style-description-small">
                        {{ getTypeDateDescription(type) }}
                    </p>

                    <p class="style-description-small">
                        {{ type.description }}
                    </p>

                    <div v-if="selectedMembershipType.id === type.id && type.behaviour === PlatformMembershipTypeBehaviour.Days">
                        <STInputBox :title="$t('%5M')" :error-box="errors.errorBox" error-fields="startDate">
                            <DateSelection v-model="customStartDate" class="option" :min="minimumStartDateForDaysTypes" />
                        </STInputBox>

                        <STInputBox :title="$t('%3w')" :error-box="errors.errorBox" error-fields="endDate">
                            <DateSelection v-model="customEndDate" class="option" :min="minimumStartDateForDaysTypes" />
                        </STInputBox>
                    </div>
                    <div v-else-if="selectedMembershipType.id === type.id">
                        <STInputBox :title="$t('%5M')" :error-box="errors.errorBox" error-fields="startDate">
                            <DateSelection
                                v-model="customStartDate"
                                class="option"
                                :min="selectedMembershipType.periods.get(period.id)?.startDate ?? undefined"
                                :max="selectedMembershipType.periods.get(period.id)?.endDate ?? undefined"
                            />
                        </STInputBox>
                    </div>

                    <template #right>
                        <span v-if="getTypePriceNormalPrice(type) === getTypePriceDescription(type)">{{ getTypePriceDescription(type) }}</span>
                        <template v-else>
                            <span class="style-discount-old-price">{{ getTypePriceNormalPrice(type) }}</span>
                            <span class="style-discount-price">{{ getTypePriceDescription(type) }}</span>
                        </template>
                    </template>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ScrollableSegmentedControl, STErrorsDefault, Toast, usePlatformFamilyManager } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MemberPlatformMembership, MemberWithRegistrationsBlob, PlatformMember, PlatformMembershipType, PlatformMembershipTypeBehaviour, RegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { useErrors } from '../../../errors/useErrors';
import { useOrganization, usePlatform } from '../../../hooks';
import DateSelection from '../../../inputs/DateSelection.vue';

const props = defineProps<{
    member: PlatformMember;
    period: RegistrationPeriod;
}>();

const title = $t('%3y');
const loading = ref(false);
const saveText = $t(`%SN`);
const organization = useOrganization();
const platform = usePlatform();
const now = new Date();

const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const customStartDate = ref(today);
const customEndDate = ref(today);
const minimumStartDateForDaysTypes = today;

if (customStartDate.value < props.period.startDate) {
    customStartDate.value = props.period.startDate;
}
if (customEndDate.value > props.period.endDate) {
    customEndDate.value = props.period.endDate;
}

const errors = useErrors();
const platformFamilyManager = usePlatformFamilyManager();
const pop = usePop();

const availableOrganizations = computed(() => organization.value ? [organization.value] : props.member.organizations);
const selectedOrganization = ref(availableOrganizations.value[0] ?? null);

const availableMembershipTypes = computed(() => {
    if (!selectedOrganization.value) {
        return [];
    }
    const tags = selectedOrganization.value!.meta.tags;

    const memberDefaultAgeGroupIds = props.member.filterRegistrations({
        periodId: props.period.id,
    }).map(r => r.group.defaultAgeGroupId)
        .filter(id => id !== null);

    return platform.value.config.getEnabledPlatformMembershipTypes(tags, memberDefaultAgeGroupIds);
});

const selectedMembershipType = ref(availableMembershipTypes.value[0] ?? null);

async function save() {
    if (!selectedMembershipType.value) {
        return;
    }

    if (loading.value) {
        return;
    }

    loading.value = true;

    errors.errorBox = null;

    try {
        const periodConfig = selectedMembershipType.value.periods.get(props.period.id);
        if (!periodConfig) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('%8Y'),
            });
        }

        const errors = new SimpleErrors();

        if (selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days) {
            if (customStartDate.value < today) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: $t(`%10E`),
                }));
            }

            if (customStartDate.value.getTime() > customEndDate.value.getTime()) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'endDate',
                    message: $t(`%Dc`),
                }));
            }

            if (customStartDate.value < periodConfig.startDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: $t(`%15A`, { date: Formatter.date(periodConfig.startDate) }),
                }));
            }

            if (customStartDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: $t(`%15B`, { date: Formatter.date(periodConfig.endDate) }),
                }));
            }

            if (customEndDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'endDate',
                    message: $t(`%15C`, { date: Formatter.date(periodConfig.endDate) }),
                }));
            }
        }

        if (selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Period) {
            if (customStartDate.value < periodConfig.startDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: $t(`%15A`, { date: Formatter.date(periodConfig.startDate) }),
                }));
            }

            if (customStartDate.value > periodConfig.endDate) {
                errors.addError(new SimpleError({
                    code: 'invalid_field',
                    field: 'startDate',
                    message: $t(`%15B`, { date: Formatter.date(periodConfig.endDate) }),
                }));
            }
        }

        errors.throwIfNotEmpty();

        // Execute an isolated patch
        const platformMembershipsPatch = new PatchableArray() as PatchableArrayAutoEncoder<MemberPlatformMembership>;
        platformMembershipsPatch.addPut(
            MemberPlatformMembership.create({
                memberId: props.member.member.id,
                membershipTypeId: selectedMembershipType.value.id,
                organizationId: selectedOrganization.value!.id,
                periodId: props.period.id,
                startDate: customStartDate.value,
                endDate: selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days ? customEndDate.value : periodConfig.endDate,
                expireDate: selectedMembershipType.value.behaviour === PlatformMembershipTypeBehaviour.Days ? null : periodConfig.expireDate,
            }),
        );

        const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
        patch.addPatch(MemberWithRegistrationsBlob.patch({
            id: props.member.member.id,
            platformMemberships: platformMembershipsPatch,
        }));

        await platformFamilyManager.isolatedPatch([props.member], patch, false);

        Toast.success($t(`%10F`)).show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loading.value = false;
}

function getTypeAvailable(type: PlatformMembershipType) {
    return type.periods.has(props.period.id);
}

function getTypeDateDescription(type: PlatformMembershipType) {
    const periodConfig = type.periods.get(props.period.id);
    if (!periodConfig) {
        return '';
    }

    if (type.behaviour === PlatformMembershipTypeBehaviour.Days) {
        return '';
    }

    return Formatter.date(periodConfig.startDate, true) + ' - ' + Formatter.date(periodConfig.expireDate ?? periodConfig.endDate, true);
}

function getTypePriceDescription(type: PlatformMembershipType) {
    return getPriceForDate(type, new Date());
}

function getTypePriceNormalPrice(type: PlatformMembershipType) {
    return getPriceForDate(type, new Date(1));
}

function getPriceForDate(type: PlatformMembershipType, date: Date) {
    const periodConfig = type.periods.get(props.period.id);
    if (!periodConfig) {
        return $t(`%10G`);
    }

    if (selectedOrganization.value.id === platform.value.membershipOrganizationId) {
        return Formatter.price(0);
    }

    const priceConfig = periodConfig.getPriceConfigForDate(date);

    if (type.behaviour === PlatformMembershipTypeBehaviour.Days) {
        return Formatter.price(priceConfig.pricePerDay) + ' ' + $t(`%I8`);
    }

    const tagIds = selectedOrganization.value?.meta.tags ?? [];
    const shouldApplyReducedPrice = props.member.shouldApplyReducedPrice;
    const price = priceConfig.getBasePrice(tagIds, shouldApplyReducedPrice);

    return Formatter.price(price);
}
</script>
