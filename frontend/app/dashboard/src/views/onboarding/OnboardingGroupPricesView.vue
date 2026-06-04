<template>
    <SaveView :title="title" :save-text="$t('Voltooien')" save-icon-right="success" :loading="saving" :prefer-large-button="true" @save="goNext">
        <aside class="style-title-prefix">
            {{ $t('Stap {current} van {total}', { current: props.stepNumber.toString(), total: props.stepCount.toString() }) }}
        </aside>
        <h1>
            {{ title }}
        </h1>
        <p>
            {{ $t('Stel per onderverdeling een standaardtarief in. Wil je een groep volledig instellen, gebruik dan de instellingenknop.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem v-for="group in groups" :key="group.id" element-name="label" class="right-stack" :selectable="true" @contextmenu.prevent="openMenu($event, group)">
                <template #left>
                    <GroupAvatar :group="group" />
                </template>

                <h3 class="style-title-list">
                    {{ group.settings.name }}
                </h3>

                <template #right>
                    <span v-if="hasMultiplePrices(group)" v-tooltip="$t('Deze groep heeft meerdere tarieven. Pas ze aan via de instellingen.')" class="style-tag">
                        {{ $t('Verschillend') }}
                    </span>
                    <PriceInput
                        v-else
                        :model-value="getPrice(group)"
                        :placeholder="$t('Gratis')"
                        @update:model-value="setPrice(group, $event)"
                    />

                    <button v-tooltip="$t('Instellingen')" class="button icon settings gray small" type="button" @click.stop="openSettings(group)" />
                    <button v-tooltip="$t('Meer')" class="button icon more gray small" type="button" @click.stop="openMenu($event, group)" />
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { Group, GroupPrice, GroupSettings, OrganizationRegistrationPeriod, ReduceablePrice } from '@stamhoofd/structures';
import { computed, reactive, ref } from 'vue';
import { useGroupActions } from '../members/useGroupActions';
import type { OnboardingStepProps } from './useMemberAdministrationOnboarding';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';

const props = defineProps<OnboardingStepProps>();
const navigationActions = useNavigationActions();
const patchOrganizationPeriod = usePatchOrganizationPeriod();
const getGroupActions = useGroupActions();
const errors = useErrors();
const saving = ref(false);

const title = $t('Prijzen instellen');

const viewModel = props.viewModel;
const groups = computed(() => viewModel.membershipGroups);

// Local edits of the single default price per group (in cents).
const priceValues = reactive<Record<string, number>>({});

function hasMultiplePrices(group: Group) {
    return group.settings.prices.length !== 1;
}

function getPrice(group: Group): number {
    return priceValues[group.id] ?? group.settings.prices[0]?.price.price ?? 0;
}

function setPrice(group: Group, value: number) {
    priceValues[group.id] = value;
}

function openSettings(group: Group) {
    getGroupActions({ group, period: viewModel.period }).editGroup().catch(console.error);
}

function openMenu(event: MouseEvent, group: Group) {
    getGroupActions({ group, period: viewModel.period }).showMenu(event).catch(console.error);
}

async function goNext() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        const periodPatch = OrganizationRegistrationPeriod.patch({ id: viewModel.period.id });
        let hasChanges = false;

        for (const group of groups.value) {
            if (hasMultiplePrices(group)) {
                continue;
            }
            const currentPrice = group.settings.prices[0];
            const newValue = priceValues[group.id];
            if (newValue === undefined || newValue === currentPrice.price.price) {
                continue;
            }

            const settings = GroupSettings.patch({});
            settings.prices.addPatch(GroupPrice.patch({
                id: currentPrice.id,
                price: ReduceablePrice.patch({ price: newValue }),
            }));
            periodPatch.groups.addPatch(Group.patch({ id: group.id, settings }));
            hasChanges = true;
        }

        if (hasChanges) {
            await patchOrganizationPeriod(viewModel.period, periodPatch);
        }

        await props.saveHandler(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}
</script>
