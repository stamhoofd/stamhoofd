<template>
    <LoadingViewTransition :error-box="loadingExternalOrganizerErrorBox">
        <SaveView v-if="!loadingOrganizer && patchedPeriod" :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
            <template #buttons>
                <button v-if="!isNew && type !== GroupType.EventRegistration" class="button icon history" type="button" @click="viewAudit" />
            </template>
            <h1>
                {{ title }}

                <span v-if="patchedGroup.settings.period && patchedGroup.settings.period.id !== patchedPeriod.period.id" class="title-suffix">
                    {{ patchedGroup.settings.period.nameShort }}
                </span>
            </h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <template v-if="type === GroupType.Membership">
                <p v-if="isNew" class="info-box">
                    {{ $t('%cI') }}
                </p>

                <div class="split-inputs">
                    <TInput v-model="name" :placeholder="$t(`%d8`)" error-fields="settings.name" :error-box="errors.errorBox" :title="$t(`%Gq`)" />

                    <STInputBox v-if="defaultAgeGroupsFiltered.length" :title="$t('%2')" error-fields="settings.defaultAgeGroupId" :error-box="errors.errorBox">
                        <Dropdown v-model="defaultAgeGroupId">
                            <option :value="null">
                                {{ $t('%cJ') }}
                            </option>
                            <option v-for="ageGroup of defaultAgeGroupsFiltered" :key="ageGroup.id" :value="ageGroup.id">
                                {{ getAgeGroupSelectionText(ageGroup) }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </div>
                <p v-if="defaultAgeGroups.length" class="style-description-small">
                    {{ $t('%3') }}
                </p>
            </template>

            <template v-if="type === GroupType.WaitingList">
                <div class="split-inputs">
                    <TInput v-model="name" :placeholder="$t(`%d9`)" error-fields="settings.name" :error-box="errors.errorBox" :title="$t(`%Gq`)" />
                </div>
            </template>

            <TTextarea v-model="description" :placeholder="$t(`%dA`)" error-fields="settings.description" :error-box="errors.errorBox" class="max" :title="$t(`%6o`)" />
            <p v-if="patchedGroup.type === GroupType.EventRegistration" class="style-description-small">
                {{ $t('%cK') }}
            </p>

            <STList v-if="nonPatchedGroup.settings.hasCustomDates">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="hasCustomDates" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%1GC') }}
                    </h3>

                    <template v-if="hasCustomDates">
                        <div class="split-inputs option" @click.stop.prevent>
                            <STInputBox :title="$t('%7e')" error-fields="settings.startDate" :error-box="errors.errorBox">
                                <DateSelection v-model="startDate" :placeholder-date="patchedGroup.settings.startDate" />
                            </STInputBox>
                            <TimeInput v-model="startDate" :validator="errors.validator" :title="$t('%1GD')" />
                        </div>

                        <div class="split-inputs option" @click.stop.prevent>
                            <STInputBox :title="$t('%wB')" error-fields="settings.endDate" :error-box="errors.errorBox">
                                <DateSelection v-model="endDate" :placeholder-date="patchedGroup.settings.endDate" :min="startDate" />
                            </STInputBox>
                            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t('%1GD')" />
                        </div>
                    </template>
                </STListItem>
            </STList>

            <template v-if="patchedGroup.type === GroupType.EventRegistration && isMultiOrganization">
                <hr><h2>{{ $t('%cL') }}</h2>
                <p>{{ $t('%cM') }}</p>
                <p class="style-description-block">
                    {{ $t('%cN') }}
                </p>

                <STList>
                    <STListItem v-if="externalOrganization" :selectable="isNew" @click="isNew ? chooseOrganizer('Kies een organisator') : undefined">
                        <template #left>
                            <OrganizationAvatar :organization="externalOrganization" />
                        </template>

                        <h3 class="style-title-list">
                            {{ externalOrganization.name }}
                        </h3>
                        <p class="style-description">
                            {{ externalOrganization.address.anonymousString(Country.Belgium) }}
                        </p>

                        <template v-if="isNew" #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <div v-if="type !== GroupType.WaitingList || patchedGroup.settings.prices.length !== 1 || patchedGroup.settings.prices[0]?.price.price" class="container">
                <hr><h2 class="style-with-button">
                    <div>{{ $t('%61') }}</div>
                    <div>
                        <button class="button text only-icon-smartphone" type="button" @click="addGroupPrice">
                            <span class="icon add" />
                            <span>{{ $t('%62') }}</span>
                        </button>
                    </div>
                </h2>
                <p>{{ $t("%6e") }}</p>

                <STList v-if="patchedGroup.settings.prices.length !== 1" v-model="draggablePrices" :draggable="true">
                    <template #item="{item: price}">
                        <STListItem :selectable="true" class="right-stack" @click="editGroupPrice(price)">
                            <h3 class="style-title-list">
                                {{ price.name }}
                            </h3>

                            <p class="style-description-small">
                                {{ $t('%1IP') }}: {{ formatPrice(price.price.price) }}
                            </p>

                            <p v-if="price.price.reducedPrice !== null" class="style-description-small">
                                {{ reducedPriceName }}: <span>{{ formatPrice(price.price.reducedPrice) }}</span>
                            </p>

                            <p v-if="price.startDate" class="style-description-small">
                                {{ $t('%1CL', {date: formatStartDate(price.startDate)}) }}
                            </p>
                            <p v-if="price.endDate" class="style-description-small">
                                {{ $t('%1CM', {date: formatEndDate(price.endDate)}) }}
                            </p>

                            <p v-for="[id, discount] of price.bundleDiscounts" :key="id" class="style-description-small">
                                <span class="icon small label" /><span>{{ discount.name.toString() }}</span>
                            </p>

                            <p v-if="price.isSoldOut(patchedGroup)" class="style-description-small">
                                {{ $t('%12p') }}
                            </p>
                            <p v-else-if="price.stock" class="style-description-small">
                                {{ $t('%U3', {stock: pluralText(price.getRemainingStock(patchedGroup) ?? 0, 'stuk', 'stuks')}) }}
                            </p>

                            <template #right>
                                <span v-if="price.hidden" :v-tooltip="$t('%UC')" class="icon gray eye-off" />
                                <span class="button icon drag gray" @click.stop @contextmenu.stop />
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </template>
                </STList>
                <GroupPriceBox v-else :period="patchedPeriod" :price="patchedGroup.settings.prices[0]" :group="patchedGroup" :errors="errors" :default-membership-type-id="defaultMembershipTypeId" :validator="errors.validator" :external-organization="externalOrganization" @patch:period="addPatch" @patch:price="addPricePatch" />
            </div>

            <div v-for="optionMenu of patchedGroup.settings.optionMenus" :key="optionMenu.id" class="container">
                <hr><GroupOptionMenuBox :option-menu="optionMenu" :group="patchedGroup" :errors="errors" :level="2" @patch:group="addPatch" @patch:option-menu="addOptionMenuPatch" @delete="addOptionMenuDelete(optionMenu.id)" />
            </div>

            <hr><STList>
                <STListItem :selectable="true" element-name="button" @click="addGroupOptionMenu()">
                    <template #left>
                        <span class="icon add gray" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%cO') }}
                    </h3>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('%cP') }}</h2>
            <p>{{ $t('%cQ') }}</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" :value="GroupStatus.Closed" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%cR') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%cS') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" value="RegistrationStartDate" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%cT') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%cU') }}
                    </p>

                    <div v-if="virtualOpenStatus === 'RegistrationStartDate'" class="split-inputs option" @click.stop.prevent>
                        <STInputBox :title="$t('%4P')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                            <DateSelection v-model="registrationStartDate" />
                        </STInputBox>
                        <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('%5M')" :validator="errors.validator" />
                    </div>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" :value="GroupStatus.Open" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%28') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('%cV') }}
                    </p>
                </STListItem>

                <STListItem v-if="virtualOpenStatus !== GroupStatus.Closed" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useRegistrationEndDate" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%5K') }}
                    </h3>

                    <div v-if="useRegistrationEndDate" class="split-inputs option" @click.stop.prevent>
                        <STInputBox :title="$t('%4O')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                            <DateSelection v-model="registrationEndDate" />
                        </STInputBox>
                        <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('%5L')" :validator="errors.validator" />
                    </div>
                </STListItem>
            </STList>

            <div v-if="patchedGroup.type === GroupType.Membership" class="container">
                <hr><h2>{{ $t('%cW') }}</h2>

                <template v-if="isPropertyEnabled('birthDay')">
                    <div class="split-inputs">
                        <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`%Hm`)">
                            <AgeInput v-model="minAge" :year="patchedGroup.settings.startDate.getFullYear()" :nullable="true" :placeholder="$t(`%4a`)" />
                        </STInputBox>

                        <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`%Hn`)">
                            <AgeInput v-model="maxAge" :year="patchedGroup.settings.startDate.getFullYear()" :nullable="true" :placeholder="$t(`%4a`)" />
                        </STInputBox>
                    </div>
                    <p class="style-description-small">
                        *{{ $t('%cX') }}{{ patchedGroup.settings.startDate.getFullYear() }}.<template v-if="externalOrganization?.address.country === Country.Belgium">
                            {{ $t('%cY') }}
                        </template>
                    </p>
                </template>

                <STInputBox v-if="isPropertyEnabled('gender')" error-fields="genderType" :error-box="errors.errorBox" class="max" :title="$t(`%dB`)">
                    <STList>
                        <STListItem v-for="_genderType in genderTypes" :key="_genderType.value" element-name="label" :selectable="true">
                            <template #left>
                                <Radio v-model="genderType" :value="_genderType.value" />
                            </template>

                            <h3 class="style-title-list">
                                {{ _genderType.name }}
                            </h3>
                        </STListItem>
                    </STList>
                </STInputBox>

                <STInputBox v-if="requirePlatformMembershipOnRegistrationDate || (!defaultAgeGroupId)" error-fields="requirePlatformMembershipOnRegistrationDate" :error-box="errors.errorBox" class="max" :title="$t(`%Wq`)">
                    <STList>
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="requirePlatformMembershipOnRegistrationDate" />
                            </template>

                            <h3 class="style-title-list">
                                {{ $t('%cZ') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%ca') }}
                            </p>
                        </STListItem>
                    </STList>
                </STInputBox>

                <button v-if="requireGroupIds.length === 0" type="button" class="button text" @click="addRequireGroupIds">
                    <span class="icon add" />
                    <span>{{ $t('%cb') }}</span>
                </button>

                <button v-if="preventGroupIds.length === 0" type="button" class="button text" @click="addPreventGroupIds">
                    <span class="icon add" />
                    <span>{{ $t('%1Gx') }}</span>
                </button>
            </div>

            <div v-if="showAllowRegistrationsByOrganization || showEnableMaxMembers" class="container">
                <hr><h2>{{ $t('%1CP') }}</h2>
                <STList>
                    <template v-if="isMultiOrganization">
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('%cc') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%cd') }}
                            </p>
                        </STListItem>

                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowViewRegistrations" :disabled="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t(`%1HL`) }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%1HJ') }}
                            </p>
                        </STListItem>

                        <STListItem v-if="allowRegistrationsByOrganization" :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="sendConfirmationEmailForManualRegistrations" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('%1At') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%1Au') }}
                            </p>
                        </STListItem>
                    </template>
                    <template v-else-if="showAllowRegistrationsByOrganization">
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowViewRegistrations" :disabled="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t(`%1HM`) }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%1HJ') }}
                            </p>
                        </STListItem>

                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t(`%1HN`) }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%1HK') }}
                            </p>
                        </STListItem>
                    </template>

                    <STListItem v-if="showEnableMaxMembers" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="enableMaxMembers" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%ce', {stock: usedStock.toString()}) }}
                        </h3>
                        <div v-if="enableMaxMembers" class="option" @click.stop.prevent>
                            <STInputBox title="" error-fields="maxMembers" :error-box="errors.errorBox">
                                <DeprecatedNumberInput v-model="maxMembers" :min="0" suffix="leden" suffix-singular="lid" />
                            </STInputBox>
                            <p class="style-description-small">
                                {{ $t('%cf') }}
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </div>

            <div v-if="type === GroupType.Membership || type === GroupType.EventRegistration || waitingList" class="container">
                <hr><h2>{{ $t('%1IQ') }}</h2>
                <p>{{ $t('%cg') }}</p>
                <p class="style-description-block">
                    {{ $t('%ch') }}
                </p>

                <STList v-if="availableWaitingLists.length">
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingList" :value="null" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%ci') }}
                        </h3>
                    </STListItem>

                    <STListItem v-for="{list, description: waitingListDescription} of availableWaitingLists" :key="list.id" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingList" :value="list" />
                        </template>

                        <h3 class="style-title-list">
                            {{ list.settings.name }}
                        </h3>
                        <p class="style-description-small pre-wrap" v-text="waitingListDescription" />

                        <template #right>
                            <button class="button icon edit gray" type="button" @click="editWaitingList(list)" />
                        </template>
                    </STListItem>
                </STList>
                <p v-else class="info-box">
                    {{ $t('%cj') }}
                </p>

                <p class="style-button-bar">
                    <button type="button" class="button text" @click="addWaitingList">
                        <span class="icon add" />
                        <span>{{ $t('%ck') }}</span>
                    </button>
                </p>
            </div>

            <template v-if="waitingListType !== WaitingListType.None || (enableMaxMembers && type === GroupType.Membership)">
                <hr><h2>{{ $t('%cl') }}</h2>
                <p>{{ $t('%cm') }}</p>

                <p v-if="waitingListType === WaitingListType.PreRegistrations || waitingListType === WaitingListType.ExistingMembersFirst" class="info-box">
                    {{ $t('%8V') }}
                </p>

                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.None" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%cn') }}
                        </h3>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.ExistingMembersFirst" :disabled="!waitingList" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%co') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('%cp') }}
                        </p>

                        <p v-if="!waitingList" class="style-description-small">
                            {{ $t('%cq') }}
                        </p>

                        <div v-if="waitingListType === WaitingListType.ExistingMembersFirst" class="option">
                            <Checkbox v-model="priorityForFamily">
                                {{ $t('%cr') }}
                            </Checkbox>
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.All" :disabled="!waitingList" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%cs') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('%ct') }}
                        </p>

                        <p v-if="!waitingList" class="style-description-small">
                            {{ $t('%cq') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :for="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)">
                        <template #left>
                            <Radio :id="WaitingListType.PreRegistrations" v-model="waitingListType" :value="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('%cu') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('%cv') }}
                        </p>

                        <p v-if="!registrationStartDate" class="style-description-small">
                            {{ $t('%cw') }}
                        </p>

                        <div v-if="waitingListType === WaitingListType.PreRegistrations" class="option">
                            <div class="split-inputs">
                                <STInputBox error-fields="settings.preRegistrationsDate" :error-box="errors.errorBox" :title="$t(`%dC`)">
                                    <DateSelection v-model="preRegistrationsDate" />
                                </STInputBox>

                                <TimeInput v-model="preRegistrationsDate" :validator="errors.validator" :title="$t(`%5M`)" />
                            </div>

                            <Checkbox v-model="priorityForFamily">
                                {{ $t('%cx') }}
                            </Checkbox>
                        </div>
                    </STListItem>
                </STList>
            </template>

            <JumpToContainer v-if="patchedGroup.type === GroupType.Membership" class="container" :visible="forceShowRequireGroupIds || !!requireGroupIds.length">
                <GroupIdsInput v-model="requireGroupIds" :default-period-id="patchedGroup.periodId" :title="$t(`%dD`)" />
            </JumpToContainer>

            <JumpToContainer v-if="patchedGroup.type === GroupType.Membership" class="container" :visible="forceShowPreventGroupIds || !!preventGroupIds.length">
                <GroupIdsInput v-model="preventGroupIds" :default-period-id="patchedGroup.periodId" :title="$t('%1Gx')" />
            </JumpToContainer>

            <template v-if="$feature('member-trials')">
                <template v-if="patchedGroup.type === GroupType.Membership && (!defaultMembershipConfig || defaultMembershipConfig.trialDays)">
                    <hr><h2>{{ $t('%7r') }}</h2>
                    <p>{{ $t('%7s') }}</p>

                    <STInputBox :title="$t('%CG')" error-fields="settings.trialDays" :error-box="errors.errorBox">
                        <DeprecatedNumberInput v-model="trialDays" :suffix="$t('%1N6')" :suffix-singular="$t('%1N7')" :min="0" :max="defaultMembershipConfig?.trialDays ?? null" />
                    </STInputBox>
                    <p v-if="defaultMembershipConfig && defaultMembershipConfig.trialDays" class="style-description-small">
                        {{ $t('%7t', {days: Formatter.days(defaultMembershipConfig.trialDays)}) }}
                    </p>

                    <template v-if="!hasCustomDates">
                        <STInputBox :title="$t('%7u')" error-fields="settings.startDate" :error-box="errors.errorBox">
                            <DateSelection v-model="startDate" :placeholder-date="patchedGroup.settings.startDate" :min="patchedPeriod.period.startDate" :max="patchedPeriod.period.endDate" />
                        </STInputBox>

                        <p class="style-description-small">
                            {{ $t('%7v') }}
                        </p>
                    </template>
                    <p v-else-if="trialDays && patchedGroup.settings.startDate.getTime() !== patchedPeriod.period.startDate.getTime()" class="info-box">
                        {{ $t('%1GE', {start: Formatter.date(patchedGroup.settings.startDate)}) }}
                    </p>
                </template>
            </template>

            <hr><h2>{{ $t('%cy') }}</h2>
            <p>{{ $t('%cz') }}</p>
            <p v-if="auth.hasFullAccess()" class="info-box">
                {{ $t('%d0') }}
            </p>
            <InheritedRecordsConfigurationBox :group-level="true" :override-organization="externalOrganization" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />

            <hr><h2>{{ $t('%d1') }}</h2>
            <p>{{ $t('%d2') }} <strong class="style-strong">{{ $t('%d3') }}</strong> {{ $t('%d4') }}</p>

            <p class="warning-box">
                <span>
                    {{ $t('%d5') }} <strong class="style-strong style-underline">{{ $t('%d6') }}</strong> {{ $t('%d7') }}
                </span>
            </p>

            <EditRecordCategoriesBox :categories="patchedGroup.settings.recordCategories" :settings="recordEditorSettings" @patch:categories="addRecordCategoriesPatch" />
        </SaveView>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import AuditLogsView from '#audit-logs/AuditLogsView.vue';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import OrganizationAvatar from '#context/OrganizationAvatar.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useValidation } from '#errors/useValidation.ts';
import { useRegisterItemFilterBuilders } from '#filters/filterBuilders.ts';
import AgeInput from '#inputs/AgeInput.vue';
import DateSelection from '#inputs/DateSelection.vue';
import DeprecatedNumberInput from '#inputs/DeprecatedNumberInput.vue';
import Dropdown from '#inputs/Dropdown.vue';
import GroupIdsInput from '#inputs/GroupIdsInput.vue';
import TimeInput from '#inputs/TimeInput.vue';
import EditRecordCategoriesBox from '#records/components/EditRecordCategoriesBox.vue';
import InheritedRecordsConfigurationBox from '#records/components/InheritedRecordsConfigurationBox.vue';
import { RecordEditorSettings, RecordEditorType } from '#records/RecordEditorSettings.ts';
import type { AutoEncoderPatchType, PartialWithoutMethods, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import type { DefaultAgeGroup, MemberProperty, RecordCategory } from '@stamhoofd/structures';
import { BooleanStatus, Group, GroupGenderType, GroupOption, GroupOptionMenu, GroupPrice, GroupPrivateSettings, GroupSettings, GroupStatus, GroupType, MemberDetails, MemberWithRegistrationsBlob, Organization, OrganizationRecordsConfiguration, OrganizationRegistrationPeriod, Platform, PlatformFamily, PlatformMember, RegisterItem, TranslatedString, WaitingListType } from '@stamhoofd/structures';
import { Country } from "@stamhoofd/types/Country";
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import JumpToContainer from '../containers/JumpToContainer.vue';
import { useErrors } from '../errors/useErrors';
import { useAuth, useDraggableArray, useOrganization, usePatch, usePatchableArray, usePlatform } from '../hooks';
import TInput from '../inputs/TInput.vue';
import TTextarea from '../inputs/TTextarea.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import GroupOptionMenuBox from './components/GroupOptionMenuBox.vue';
import GroupOptionMenuView from './components/GroupOptionMenuView.vue';
import GroupPriceBox from './components/GroupPriceBox.vue';
import GroupPriceView from './components/GroupPriceView.vue';
import EditGroupView from './EditGroupView.vue';
import { useExternalOrganization, useFinancialSupportSettings } from './hooks';

const props = withDefaults(
    defineProps<{
        isNew: boolean;
        period: OrganizationRegistrationPeriod;
        groupId: string;
        isMultiOrganization?: boolean;
        saveHandler: (period: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>;
        showToasts?: boolean;
        organizationHint?: Organization | null;
    }>(),
    {
        showToasts: true,
        isMultiOrganization: false,
        organizationHint: null,
    },
);

const platform = usePlatform();
const organization = useOrganization();
const { patched: patchedPeriod, hasChanges, addPatch, patch } = usePatch(props.period);
const nonPatchedGroup = props.period.groups.find(group => group.id === props.groupId)!;
const patchedGroup = computed(() => patchedPeriod.value.groups.find(group => group.id === props.groupId)!);
const groupBeforePatch = computed(() => props.period.groups.find(group => group.id === props.groupId)!);
if (!groupBeforePatch.value) {
    console.error(`Group with id ${props.groupId} not found in OrganizationRegistrationPeriod`);
}

function addGroupPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<Group>>) {
    const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();
    groups.addPatch(Group.patch({ id: props.groupId, ...newPatch }));
    addPatch({ groups });
}

const forceShowRequireGroupIds = ref(false);
const forceShowPreventGroupIds = ref(false);
const usedStock = computed(() => patchedGroup.value.settings.getUsedStock(patchedGroup.value) || 0);
const auth = useAuth();

function addRequireGroupIds() {
    forceShowRequireGroupIds.value = true;
}

function addPreventGroupIds() {
    forceShowPreventGroupIds.value = true;
}

async function viewAudit() {
    await present({
        components: [
            new ComponentWithProperties(AuditLogsView, {
                objectIds: [props.groupId],
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const { externalOrganization, choose: chooseOrganizer, loading: loadingOrganizer, errorBox: loadingExternalOrganizerErrorBox } = useExternalOrganization(
    computed({
        get: () => patchedGroup.value.organizationId,
        set: (organizationId: string) => addGroupPatch({
            organizationId,
        }),
    }),
    props.organizationHint,
);

const patchPricesArray = (prices: PatchableArrayAutoEncoder<GroupPrice>) => {
    addGroupPatch({
        settings: GroupSettings.patch({
            prices,
        }),
    });
};

function addRecordCategoriesPatch(categories: PatchableArrayAutoEncoder<RecordCategory>) {
    addGroupPatch({
        settings: GroupSettings.patch({
            recordCategories: categories,
        }),
    });
}

const { addPatch: addPricePatch, addDelete: addPriceDelete } = usePatchableArray(patchPricesArray);
const draggablePrices = useDraggableArray(() => patchedGroup.value.settings.prices, patchPricesArray);

const { addPatch: addOptionMenuPatch, addPut: addOptionMenuPut, addDelete: addOptionMenuDelete } = usePatchableArray((optionMenus: PatchableArrayAutoEncoder<GroupOptionMenu>) => {
    addGroupPatch({
        settings: GroupSettings.patch({
            optionMenus,
        }),
    });
});

const recordsConfiguration = computed(() => patchedGroup.value.settings.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addGroupPatch({
        settings: GroupSettings.patch({
            recordsConfiguration,
        }),
    });
};
const inheritedRecordsConfiguration = computed(() => {
    return OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patchedGroup.value,
        includeGroup: false,
    });
});

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

useValidation(errors.validator, () => {
    for (const group of patchedPeriod.value.groups) {
        if (group.id === props.groupId) {
            try {
                group.settings.throwIfInvalidPrices();
            }
            catch (e) {
                errors.errorBox = new ErrorBox(e);
                return false;
            }
        }
    }

    return true;
});

const pop = usePop();
const { priceName: reducedPriceName } = useFinancialSupportSettings({
    group: patchedGroup,
});
const present = usePresent();
const didSetAutomaticGroup = ref(false);

const availableWaitingLists = computed(() => {
    let base = patchedPeriod.value.waitingLists;

    // Add patched waiting list and the end, to maintain ordering
    if (patchedGroup.value.waitingList) {
        base.push(patchedGroup.value.waitingList);
    }

    base = base.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

    return base.map((list) => {
        const usedByGroups = patchedPeriod.value.groups.filter(g => g.waitingList?.id === list.id);
        let d = usedByGroups?.length ? $t(`%14l`, { groupNames: Formatter.joinLast(usedByGroups.map(g => g.settings.name.toString()), ', ', ' ' + $t(`%M1`) + ' ') }) : $t(`%yg`);
        if (list.periodId !== patchedPeriod.value.period.id && list.settings.period) {
            d = list.settings.period.nameShort + '\n' + d;
        }
        return {
            list,
            description: d,
        };
    });
});

const defaultAgeGroups = computed(() => {
    return platform.value.config.defaultAgeGroups;
});

const defaultAgeGroupsFiltered = computed(() => {
    const tags = organization.value?.meta.tags ?? [];
    return defaultAgeGroups.value.filter(defaultAgeGroup => defaultAgeGroup.isEnabledForTags(tags));
});

const defaultAgeGroup = computed(() => {
    return defaultAgeGroups.value.find(g => g.id === patchedGroup.value.defaultAgeGroupId);
});

const name = computed({
    get: () => patchedGroup.value.settings.name,
    set: (name) => {
        addGroupPatch({
            settings: GroupSettings.patch({
                name,
            }),
        });

        if ((!defaultAgeGroupId.value || didSetAutomaticGroup.value)) {
            const match = defaultAgeGroups.value.find(g => g.names.find(nn => StringCompare.typoCount(nn, name.toString()) === 0));
            if (match) {
                defaultAgeGroupId.value = match.id;
                didSetAutomaticGroup.value = true;
            }
            else {
                defaultAgeGroupId.value = null;
                didSetAutomaticGroup.value = true;
            }
        }
    },
});

const virtualOpenStatus = computed({
    get: () => {
        if (patchedGroup.value.status !== GroupStatus.Open) {
            return GroupStatus.Closed;
        }

        if (useRegistrationStartDate.value) {
            if (registrationStartDate.value !== groupBeforePatch.value.settings.registrationStartDate || (registrationStartDate.value && registrationStartDate.value > new Date())) {
                return 'RegistrationStartDate' as const;
            }
        }

        if (patchedGroup.value.status !== groupBeforePatch.value.status) {
            return patchedGroup.value.status;
        }

        if (patchedGroup.value.closed && groupBeforePatch.value.closed) {
            return GroupStatus.Closed;
        }

        return GroupStatus.Open;
    },
    set: (val) => {
        if (val === 'RegistrationStartDate') {
            addGroupPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = true;

            if (patchedGroup.value.settings.registrationEndDate && patchedGroup.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addGroupPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Open) {
            addGroupPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = false;

            if (patchedGroup.value.settings.registrationEndDate && patchedGroup.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addGroupPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Closed) {
            addGroupPatch({
                status: GroupStatus.Closed,
            });
        }
    },
});

const description = computed({
    get: () => patchedGroup.value.settings.description,
    set: description => addGroupPatch({
        settings: GroupSettings.patch({
            description,
        }),
    }),
});

const minAge = computed({
    get: () => patchedGroup.value.settings.minAge,
    set: minAge => addGroupPatch({
        settings: GroupSettings.patch({
            minAge,
        }),
    }),
});

const maxAge = computed({
    get: () => patchedGroup.value.settings.maxAge,
    set: maxAge => addGroupPatch({
        settings: GroupSettings.patch({
            maxAge,
        }),
    }),
});

const genderType = computed({
    get: () => patchedGroup.value.settings.genderType,
    set: genderType => addGroupPatch({
        settings: GroupSettings.patch({
            genderType,
        }),
    }),
});

const hasCustomDates = computed({
    get: () => patchedGroup.value.settings.hasCustomDates,
    set: hasCustomDates => addGroupPatch({
        settings: GroupSettings.patch({
            hasCustomDates,
        }),
    }),
});

const startDate = computed({
    get: () => patchedGroup.value.settings.startDate,
    set: startDate => addGroupPatch({
        settings: GroupSettings.patch({
            startDate,
        }),
    }),
});

const endDate = computed({
    get: () => patchedGroup.value.settings.endDate,
    set: endDate => addGroupPatch({
        settings: GroupSettings.patch({
            endDate,
        }),
    }),
});

const requireGroupIds = computed({
    get: () => patchedGroup.value.settings.requireGroupIds,
    set: requireGroupIds => addGroupPatch({
        settings: GroupSettings.patch({
            requireGroupIds: requireGroupIds as any,
        }),
    }),
});

const preventGroupIds = computed({
    get: () => patchedGroup.value.settings.preventGroupIds,
    set: preventGroupIds => addGroupPatch({
        settings: GroupSettings.patch({
            preventGroupIds: preventGroupIds as any,
        }),
    }),
});

const showAllowRegistrationsByOrganization = computed(() => props.isMultiOrganization || patchedGroup.value.type === GroupType.EventRegistration || allowRegistrationsByOrganization.value || allowViewRegistrations.value);

const allowRegistrationsByOrganization = computed({
    get: () => patchedGroup.value.settings.allowRegistrationsByOrganization,
    set: allowRegistrationsByOrganization => addGroupPatch({
        settings: GroupSettings.patch({
            allowRegistrationsByOrganization,
        }),
    }),
});

const allowViewRegistrations = computed({
    get: () => patchedGroup.value.settings.implicitlyAllowViewRegistrations,
    set: allowViewRegistrations => addGroupPatch({
        settings: GroupSettings.patch({
            allowViewRegistrations,
        }),
    }),
});

const sendConfirmationEmailForManualRegistrations = computed({
    get: () => patchedGroup.value.privateSettings?.sendConfirmationEmailForManualRegistrations ?? false,
    set: sendConfirmationEmailForManualRegistrations => addGroupPatch({
        privateSettings: GroupPrivateSettings.patch({
            sendConfirmationEmailForManualRegistrations,
        }),
    }),
});

const type = computed(() => patchedGroup.value.type);

const defaultAgeGroupId = computed({
    get: () => patchedGroup.value.defaultAgeGroupId,
    set: (defaultAgeGroupId) => {
        addGroupPatch({
            defaultAgeGroupId,
        });
        didSetAutomaticGroup.value = false;
    },
});

const waitingListType = computed({
    get: () => patchedGroup.value.settings.waitingListType,
    set: (waitingListType) => {
        addGroupPatch({
            settings: GroupSettings.patch({
                waitingListType,
            }),
        });

        if (waitingListType === WaitingListType.PreRegistrations) {
            if (!preRegistrationsDate.value && registrationStartDate.value) {
                const d = new Date(registrationStartDate.value);
                d.setMonth(d.getMonth() - 1);
                preRegistrationsDate.value = d;
            }
        }
        else {
            preRegistrationsDate.value = null;
        }
    },
});

const maxMembers = computed({
    get: () => patchedGroup.value.settings.maxMembers,
    set: maxMembers => addGroupPatch({
        settings: GroupSettings.patch({
            maxMembers,
        }),
    }),
});

const showEnableMaxMembers = computed(() => enableMaxMembers.value || type.value !== GroupType.WaitingList);

const enableMaxMembers = computed({
    get: () => patchedGroup.value.settings.maxMembers !== null,
    set: (enableMaxMembers) => {
        if (!enableMaxMembers) {
            addGroupPatch({
                settings: GroupSettings.patch({
                    maxMembers: null,
                }),
            });
        }
        else {
            addGroupPatch({
                settings: GroupSettings.patch({
                    maxMembers: patchedGroup.value.settings.maxMembers ?? 200,
                }),
            });
        }
    },
});

const requirePlatformMembershipOnRegistrationDate = computed({
    get: () => patchedGroup.value.settings.requirePlatformMembershipOnRegistrationDate === true,
    set: (value: boolean) => {
        addGroupPatch({
            settings: GroupSettings.patch({
                requirePlatformMembershipOnRegistrationDate: value,
            }),
        });
    },
});

const registrationStartDate = computed({
    get: () => patchedGroup.value.settings.registrationStartDate,
    set: registrationStartDate => addGroupPatch({
        settings: GroupSettings.patch({
            registrationStartDate,
        }),
    }),
});

const registrationEndDate = computed({
    get: () => patchedGroup.value.settings.registrationEndDate,
    set: registrationEndDate => addGroupPatch({
        settings: GroupSettings.patch({
            registrationEndDate,
        }),
    }),
});

const preRegistrationsDate = computed({
    get: () => patchedGroup.value.settings.preRegistrationsDate,
    set: preRegistrationsDate => addGroupPatch({
        settings: GroupSettings.patch({
            preRegistrationsDate,
        }),
    }),
});

const priorityForFamily = computed({
    get: () => patchedGroup.value.settings.priorityForFamily,
    set: priorityForFamily => addGroupPatch({
        settings: GroupSettings.patch({
            priorityForFamily,
        }),
    }),
});

const waitingList = computed({
    get: () => {
        if (patchedGroup.value.waitingList === null) {
            return null;
        }
        return patchedPeriod.value.waitingLists.find(w => w.id === patchedGroup.value.waitingList!.id) ?? patchedGroup.value.waitingList;
    },
    set: waitingList => addGroupPatch({
        waitingList,
    }),
});

const trialDays = computed({
    get: () => patchedGroup.value.settings.trialDays,
    set: trialDays => addGroupPatch({
        settings: GroupSettings.patch({
            trialDays,
        }),
    }),
});

const useRegistrationStartDate = computed({
    get: () => !!patchedGroup.value.settings.registrationStartDate,
    set: (useRegistrationStartDate) => {
        if (!useRegistrationStartDate) {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: null,
                }),
            });
        }
        else {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: patchedGroup.value.settings.registrationStartDate && patchedGroup.value.settings.registrationStartDate > new Date() ? patchedGroup.value.settings.registrationStartDate : new Date(Date.now() + 1000 * 60 * 60 * 24),
                }),
            });
        }
    },
});

const useRegistrationEndDate = computed({
    get: () => !!patchedGroup.value.settings.registrationEndDate,
    set: (useRegistrationEndDate) => {
        if (!useRegistrationEndDate) {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: null,
                }),
            });
        }
        else {
            addGroupPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: patchedGroup.value.settings.registrationEndDate ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                }),
            });
        }
    },
});

const title = computed(() => {
    if (patchedGroup.value.type === GroupType.WaitingList) {
        return props.isNew ? $t('%63') : $t('%64');
    }

    if (patchedGroup.value.type === GroupType.EventRegistration) {
        return props.isNew ? $t('%4M') : $t('%4K');
    }
    return props.isNew ? $t('%4N') : $t('%4L');
});

const defaultMembershipTypeId = computed(() => defaultAgeGroup.value?.defaultMembershipTypeId ?? null);

const defaultMembership = computed(() => {
    return platform.value.config.membershipTypes.find(t => t.id === defaultMembershipTypeId.value);
});
const defaultMembershipConfig = computed(() => {
    return defaultMembership.value?.periods.get(patchedGroup.value.periodId);
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        errors.errorBox = null;
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        await props.saveHandler(patch.value);
        if (props.showToasts) {
            Toast.success($t('%54')).show();
        }
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm(patchedGroup.value.type === GroupType.EventRegistration ? $t('%4I') : $t('%4J'), $t('%55'))) {
        return;
    }
    if (deleting.value || saving.value || props.isNew) {
        return;
    }

    deleting.value = true;
    try {
        const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();
        groups.addDelete(props.groupId);
        // Only patch the delete, discard all other changes
        await props.saveHandler(
            OrganizationRegistrationPeriod.patch({
                id: props.period.id,
                groups,
            }),
        );
        if (props.showToasts) {
            Toast.success($t('%1FX')).show();
        }
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        deleting.value = false;
    }
}

async function addGroupPrice() {
    const isValid = await errors.validator.validateByKey('price');

    if (isValid) {
        const price = GroupPrice.create({
            name: TranslatedString.create($t('%CL')),
            price: patchedGroup.value.settings.prices[0]?.price?.clone(),
        });

        const basePatch = OrganizationRegistrationPeriod.patch({});
        const settingsPatch = GroupSettings.patch({});
        settingsPatch.prices.addPut(price);

        const groupPatch = Group.patch({
            id: patchedGroup.value.id,
            settings: settingsPatch,
        });
        basePatch.groups.addPatch(groupPatch);

        await present({
            components: [
                new ComponentWithProperties(GroupPriceView, {
                    period: patchedPeriod.value.patch(basePatch),
                    price,
                    group: patchedGroup,
                    isNew: true,
                    defaultMembershipTypeId,
                    showNameAlways: true,
                    saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                        addPatch(basePatch.patch(patch));
                    },
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }
}

async function editGroupPrice(price: GroupPrice) {
    await present({
        components: [
            new ComponentWithProperties(GroupPriceView, {
                period: patchedPeriod.value,
                price,
                group: patchedGroup,
                isNew: false,
                defaultMembershipTypeId,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(patch);
                },
                deleteHandler: async () => {
                    addPriceDelete(price.id);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addGroupOptionMenu() {
    const optionMenu = GroupOptionMenu.create({
        name: $t('%CL'),
        options: [
            GroupOption.create({
                name: $t('%65'),
            }),
        ],
    });

    await present({
        components: [
            new ComponentWithProperties(GroupOptionMenuView, {
                optionMenu,
                group: patchedGroup,
                isNew: true,
                saveHandler: async (patch: AutoEncoderPatchType<GroupOptionMenu>) => {
                    addOptionMenuPut(optionMenu.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addWaitingList() {
    if (!externalOrganization.value) {
        return;
    }

    const waitingList = Group.create({
        organizationId: patchedGroup.value.organizationId,
        periodId: patchedGroup.value.periodId,
        type: GroupType.WaitingList,
        settings: GroupSettings.create({
            name: TranslatedString.create($t(`%yh`) + ' ' + patchedGroup.value.settings.name.toString()),
        }),
    });

    const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();
    groups.addPut(waitingList);
    const basePatch = OrganizationRegistrationPeriod.patch({ groups });

    // Edit the group
    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                period: patchedPeriod.value.patch(basePatch),
                groupId: waitingList.id,
                isNew: true,
                showToasts: false,
                organizationHint: externalOrganization.value,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(basePatch.patch(patch));
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function isPropertyEnabled(name: Exclude<MemberProperty, 'parents.nationalRegisterNumber' | 'email'>) {
    return !!OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patchedGroup.value,
        includeGroup: true,
    })[name];
}

async function editWaitingList(waitingList: Group) {
    const found = !!patchedPeriod.value.groups.find(w => w.id === waitingList.id);
    if (!found) {
        props.period.groups.push(waitingList);
        const f2 = !!patchedPeriod.value.groups.find(w => w.id === waitingList.id);
        if (!f2) {
            console.log('not found');
            return;
        }
    }

    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                period: patchedPeriod.value,
                groupId: waitingList.id,
                isNew: false,
                showToasts: false,
                organizationHint: externalOrganization.value,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const genderTypes = [
    {
        value: GroupGenderType.Mixed,
        name: $t(`%yi`),
    },
    {
        value: GroupGenderType.OnlyFemale,
        name: $t(`%yj`),
    },
    {
        value: GroupGenderType.OnlyMale,
        name: $t(`%yk`),
    },
];

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

function getAgeGroupAgeString(ageGroup: DefaultAgeGroup): string {
    const { minAge, maxAge } = ageGroup;
    if (minAge === null && maxAge === null) {
        return '';
    }

    if (minAge && maxAge) {
        return `${minAge} - ${maxAge} jaar`;
    }

    if (minAge) {
        return `+${minAge}`;
    }

    if (maxAge) {
        return `-${maxAge}`;
    }

    return '';
}

function getAgeGroupSelectionText(ageGroup: DefaultAgeGroup) {
    let text = ageGroup.name;
    const ageGroupAgeString = getAgeGroupAgeString(ageGroup);

    if (ageGroupAgeString) {
        text = text + ': ' + ageGroupAgeString;
    }

    if (!ageGroup.defaultMembershipTypeId) {
        text = text + ' ' + $t(`%yl`);
    }

    return text;
}

const getRegisterItemFilterBuilders = useRegisterItemFilterBuilders();

const family = new PlatformFamily({
    platform: Platform.shared,
    contextOrganization: organization.value,
});

const recordEditorSettings = computed(() => {
    const exampleMember = new PlatformMember({
        member: MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: $t(`%ID`),
                lastName: $t(`%ym`),
                dataPermissions: BooleanStatus.create({ value: true }),
                birthDay: new Date('2020-01-01'),
            }),
            users: [],
            registrations: [],
        }),
        isNew: true,
        family,
    });

    return new RecordEditorSettings({
        type: RecordEditorType.Registration,
        dataPermission: false,
        toggleDefaultEnabled: false,
        filterBuilder: (recordCategories: RecordCategory[]) => {
            return getRegisterItemFilterBuilders(patchedGroup.value.patch({
                settings: GroupSettings.patch({
                    recordCategories: recordCategories as any,
                }),
            }))[0];
        },
        exampleValue: RegisterItem.defaultFor(exampleMember, patchedGroup.value, externalOrganization.value ?? Organization.create({
            id: patchedGroup.value.organizationId,
        })),
    });
});

defineExpose({
    shouldNavigateAway,
});

</script>
