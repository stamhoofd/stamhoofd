<template>
    <LoadingViewTransition :error-box="loadingExternalOrganizerErrorBox">
        <SaveView v-if="!loadingOrganizer && period" :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
            <h1>
                {{ title }}
            </h1>

            <STErrorsDefault :error-box="errors.errorBox"/>

            <template v-if="type === GroupType.Membership">
                <p v-if="isNew" class="info-box">
                    {{ $t('e3c64a16-6361-40ed-85f8-600d03884acd') }}
                </p>

                <div class="split-inputs">
                    <STInputBox error-fields="settings.name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                        <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`b83e4300-a275-4c66-9442-9a3acdd85d02`)"></STInputBox>

                    <STInputBox v-if="defaultAgeGroupsFiltered.length" :title="$t('528545c4-028b-4711-9b16-f6fa990c3130')" error-fields="settings.defaultAgeGroupId" :error-box="errors.errorBox">
                        <Dropdown v-model="defaultAgeGroupId">
                            <option :value="null">
                                {{ $t('9021f693-688f-44aa-a6b6-d05252361bf9') }}
                            </option>
                            <option v-for="ageGroup of defaultAgeGroupsFiltered" :key="ageGroup.id" :value="ageGroup.id">
                                {{ getAgeGroupSelectionText(ageGroup) }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </div>
                <p v-if="defaultAgeGroups.length" class="style-description-small">
                    {{ $t('e99c7d31-f9fe-4e0f-8947-bdc30784de5b') }}
                </p>
            </template>

            <template v-if="type === GroupType.WaitingList">
                <div class="split-inputs">
                    <STInputBox error-fields="settings.name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                        <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`1cab25d2-a4c7-43de-9b7e-836ab3980dd2`)"></STInputBox>
                </div>
            </template>

            <STInputBox error-fields="settings.description" :error-box="errors.errorBox" class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
                <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`d7f8a872-3080-4e6e-b960-b1da77bf1a35`)"/>
            </STInputBox>
            <p v-if="patched.type === GroupType.EventRegistration" class="style-description-small">
                {{ $t('f0627778-1b9c-4458-b6b6-35909ab7a969') }}
            </p>

            <template v-if="patched.type === GroupType.EventRegistration && !organization && isMultiOrganization">
                <hr><h2>{{ $t('19d25fae-7429-4058-8068-2869b2134492') }}</h2>
                <p>{{ $t('c73b0a9d-7d03-4c0f-92cb-b2b76fc83ad8') }}</p>
                <p class="style-description-block">
                    {{ $t('d9291b24-3054-4628-be25-da49207a45e7') }}
                </p>

                <STList>
                    <STListItem v-if="externalOrganization" :selectable="isNew" @click="isNew ? chooseOrganizer('Kies een organisator') : undefined">
                        <template #left>
                            <OrganizationAvatar :organization="externalOrganization"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ externalOrganization.name }}
                        </h3>
                        <p class="style-description">
                            {{ externalOrganization.address.anonymousString(Country.Belgium) }}
                        </p>

                        <template v-if="isNew" #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <div v-if="type !== GroupType.WaitingList || patched.settings.prices.length !== 1 || patched.settings.prices[0]?.price.price" class="container">
                <hr><h2 class="style-with-button">
                    <div>{{ $t('0fb1a3a9-4ced-4097-b931-e865b3173cf9') }}</div>
                    <div>
                        <button class="button text only-icon-smartphone" type="button" @click="addGroupPrice">
                            <span class="icon add"/>
                            <span>{{ $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc') }}</span>
                        </button>
                    </div>
                </h2>
                <p>{{ $t("de2222d9-c934-4d06-8702-9527686de012") }}</p>

                <STList v-if="patched.settings.prices.length !== 1" v-model="draggablePrices" :draggable="true">
                    <template #item="{item: price}">
                        <STListItem :selectable="true" class="right-stack" @click="editGroupPrice(price)">
                            <h3 class="style-title-list">
                                {{ price.name }}
                            </h3>

                            <p class="style-description-small">
                                {{ $t('d7ac5b53-cbd9-4ac8-86f1-99df85c017fa') }} {{ formatPrice(price.price.price) }}
                            </p>

                            <p v-if="price.price.reducedPrice !== null" class="style-description-small">
                                {{ reducedPriceName }}: <span>{{ formatPrice(price.price.reducedPrice) }}</span>
                            </p>

                            <p v-if="price.isSoldOut(patched)" class="style-description-small">
                                {{ $t('4c249834-df40-4c1f-9c79-c56864100c36') }}
                            </p>
                            <p v-else-if="price.stock" class="style-description-small">
                                {{ $t('6878be1d-f7ca-4c4c-b6fa-de59c8028cd7') }} {{ pluralText(price.getRemainingStock(patched) ?? 0, 'stuk', 'stuks') }} {{ $t('79828b21-b66f-4e18-bb1e-bb46ee12a8af') }}
                            </p>

                            <template #right>
                                <span v-if="price.hidden" v-tooltip="$t('aff982ed-0f1a-4838-af79-9e00cd53131b')" class="icon gray eye-off"/>
                                <span class="button icon drag gray" @click.stop @contextmenu.stop/>
                                <span class="icon arrow-right-small gray"/>
                            </template>
                        </STListItem>
                    </template>
                </STList>
                <GroupPriceBox v-else :price="patched.settings.prices[0]" :group="patched" :errors="errors" :default-membership-type-id="defaultMembershipTypeId" @patch:price="addPricePatch"/>
            </div>

            <div v-for="optionMenu of patched.settings.optionMenus" :key="optionMenu.id" class="container">
                <hr><GroupOptionMenuBox :option-menu="optionMenu" :group="patched" :errors="errors" :level="2" @patch:group="addPatch" @patch:option-menu="addOptionMenuPatch" @delete="addOptionMenuDelete(optionMenu.id)"/>
            </div>

            <hr><STList>
                <STListItem :selectable="true" element-name="button" @click="addGroupOptionMenu()">
                    <template #left>
                        <span class="icon add gray"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('af9f5e45-d2ab-41f8-a8ed-1d00ebe6049f') }}
                    </h3>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('a6b62b7f-cd57-4027-a37c-bffd9f1b305f') }}</h2>
            <p>{{ $t('6a12e19c-2e37-44ab-93c0-c94d17616095') }}</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" :value="GroupStatus.Closed"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('7c1bfb0d-50b0-4848-9c22-c67b531e5cf2') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('286d8656-c88e-45d4-998f-69ad0b69ea16') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" value="RegistrationStartDate"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('533d87c9-cada-4b7e-9869-11c1ae02fe78') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('10e8c46d-26ff-4558-bd66-f5a9a21c4143') }}
                    </p>

                    <div v-if="virtualOpenStatus === 'RegistrationStartDate'" class="split-inputs option" @click.stop.prevent>
                        <STInputBox :title="$t('4f7cef46-0b46-4225-839e-510d8a8b95bc')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                            <DateSelection v-model="registrationStartDate"/>
                        </STInputBox>
                        <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('1e43813a-f48e-436c-bb49-e9ebb0f27f58')" :validator="errors.validator"/>
                    </div>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" :value="GroupStatus.Open"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('e8ddc6ce-fe87-42dd-847a-892d17a029a0') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('1419d42e-bc69-4072-a52f-4daf79592672') }}
                    </p>
                </STListItem>

                <STListItem v-if="virtualOpenStatus !== GroupStatus.Closed" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useRegistrationEndDate"/>
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('fd378bac-7d3d-4932-b511-851078805aff') }}
                    </h3>

                    <div v-if="useRegistrationEndDate" class="split-inputs option" @click.stop.prevent>
                        <STInputBox :title="$t('6905dd1f-fe82-4ddc-bc6c-9ad496d34a71')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                            <DateSelection v-model="registrationEndDate"/>
                        </STInputBox>
                        <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('1617abfe-8657-4a9f-9fe3-6e6d896c4ef6')" :validator="errors.validator"/>
                    </div>
                </STListItem>
            </STList>

            <div v-if="patched.type === GroupType.Membership" class="container">
                <hr><h2>{{ $t('3b7dc7d0-ebb2-4951-87a3-fc69cc6dcf62') }}</h2>

                <template v-if="isPropertyEnabled('birthDay')">
                    <div class="split-inputs">
                        <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`2d5fbb4b-06c0-4584-b42e-d5df9e5a5c88`)">
                            <AgeInput v-model="minAge" :year="period.startDate.getFullYear()" :nullable="true" :placeholder="$t(`948ef7e2-171d-4e02-89ce-ea3de1ab7e06`)"/>
                        </STInputBox>

                        <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`e226583e-bda3-4142-8e51-e2f872f6074c`)">
                            <AgeInput v-model="maxAge" :year="period.startDate.getFullYear()" :nullable="true" :placeholder="$t(`948ef7e2-171d-4e02-89ce-ea3de1ab7e06`)"/>
                        </STInputBox>
                    </div>
                    <p class="st-list-description">
                        {{ $t('013bc6a4-4566-4648-b4ff-4c3aa2252156') }}{{ period.startDate.getFullYear() }}.<template v-if="externalOrganization?.address.country === Country.Belgium">
                            {{ $t('40b8fd02-5fa4-4d71-92a1-551026c63410') }}
                        </template>
                    </p>
                </template>

                <STInputBox v-if="isPropertyEnabled('gender')" error-fields="genderType" :error-box="errors.errorBox" class="max" :title="$t(`305afb02-56fb-4e46-889a-fc9b63ad23dd`)">
                    <STList>
                        <STListItem v-for="_genderType in genderTypes" :key="_genderType.value" element-name="label" :selectable="true">
                            <template #left>
                                <Radio v-model="genderType" :value="_genderType.value"/>
                            </template>

                            <h3 class="style-title-list">
                                {{ _genderType.name }}
                            </h3>
                        </STListItem>
                    </STList>
                </STInputBox>

                <STInputBox error-fields="requirePlatformMembershipOnRegistrationDate" :error-box="errors.errorBox" class="max" :title="$t(`8ad3a6b5-20e9-4858-ab57-f6d524ef50af`)">
                    <STList>
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="requirePlatformMembershipOnRegistrationDate"/>
                            </template>

                            <h3 class="style-title-list">
                                {{ $t('464cedfe-4ec9-4a13-a075-7cad1e9f5926') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('c398fce5-6abe-42d0-99ca-8a858547861b') }}
                            </p>
                        </STListItem>
                    </STList>
                </STInputBox>

                <button v-if="requireGroupIds.length === 0" type="button" class="button text only-icon-smartphone" @click="addRequireGroupIds">
                    <span class="icon add"/>
                    <span>{{ $t('f225cf9e-ea57-416a-a8f7-e94bff73c195') }}</span>
                </button>
            </div>

            <div v-if="showAllowRegistrationsByOrganization || showEnableMaxMembers" class="container">
                <hr><h2>{{ $t('bdbaebf3-eae4-4736-959b-97b90f979a8d') }}</h2>
                <STList>
                    <STListItem v-if="showAllowRegistrationsByOrganization" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="allowRegistrationsByOrganization"/>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('06e1c238-546a-409a-9a0d-184edeb37b33') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('53172b47-ab22-43df-b545-890f4e963d6f') }}
                        </p>
                    </STListItem>
                    <STListItem v-if="showEnableMaxMembers" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="enableMaxMembers"/>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('1a0d6811-3df9-4f17-b9c1-3a589483a59d') }} {{ usedStock }} {{ $t('dd8428ad-8fdd-4fc5-ac64-08ededeba0f1') }}
                        </h3>
                        <div v-if="enableMaxMembers" class="option" @click.stop.prevent>
                            <STInputBox title="" error-fields="maxMembers" :error-box="errors.errorBox">
                                <NumberInput v-model="maxMembers" :min="0" suffix="leden" suffix-singular="lid"/>
                            </STInputBox>
                            <p class="style-description-small">
                                {{ $t('bdf98b08-c915-4548-9b87-bbc16a01f5ad') }}
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </div>

            <div v-if="patched.waitingList || enableMaxMembers" class="container">
                <hr><h2>{{ $t('505f83e9-65b8-4484-9595-9cdac499a9d2') }}</h2>
                <p>{{ $t('27ccea53-8836-4db9-affe-fa1d0cbc2913') }}</p>
                <p class="style-description-block">
                    {{ $t('34e7fb98-7e8a-4520-ba91-11333236e043') }}
                </p>

                <STList v-if="availableWaitingLists.length">
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingList" :value="null"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('b2f76715-37d5-40c0-893d-b15255a3c47a') }}
                        </h3>
                    </STListItem>

                    <STListItem v-for="{list, description: waitingListDescription} of availableWaitingLists" :key="list.id" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingList" :value="list"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ list.settings.name }}
                        </h3>
                        <p class="style-description-small">
                            {{ waitingListDescription }}
                        </p>

                        <template #right>
                            <button class="button icon edit gray" type="button" @click="editWaitingList(list)"/>
                        </template>
                    </STListItem>
                </STList>
                <p v-else class="info-box">
                    {{ $t('6ddd377b-57cf-4856-b4f6-1b7a742e70da') }}
                </p>

                <p class="style-button-bar">
                    <button type="button" class="button text" @click="addWaitingList">
                        <span class="icon add"/>
                        <span>{{ $t('f513024c-8771-49e2-b502-36f5bf4d7f41') }}</span>
                    </button>
                </p>
            </div>

            <template v-if="waitingListType !== WaitingListType.None || (enableMaxMembers && type === GroupType.Membership)">
                <hr><h2>{{ $t('eebded7c-75d1-4b94-a5c7-1e9816ce99bb') }}</h2>
                <p>{{ $t('2c474df7-27e6-4d11-b441-2c7f187fbb9e') }}</p>

                <p v-if="waitingListType === WaitingListType.PreRegistrations || waitingListType === WaitingListType.ExistingMembersFirst" class="info-box">
                    {{ $t('e2130593-e64d-4f3a-bb16-75ba4ed7604e') }}
                </p>

                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.None"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('d7188e4d-0f48-40a5-b570-53094e4338a5') }}
                        </h3>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.ExistingMembersFirst" :disabled="!waitingList"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('b8e99c4f-1f32-49bf-9dd1-ab9bb0605098') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('5b0f22c8-6241-4ac6-84b2-e8455fac50d2') }}
                        </p>

                        <p v-if="!waitingList" class="style-description-small">
                            {{ $t('f14b12c3-60f8-4444-ab1a-6cd86fbdd8ca') }}
                        </p>

                        <div v-if="waitingListType === WaitingListType.ExistingMembersFirst" class="option">
                            <Checkbox v-model="priorityForFamily">
                                {{ $t('79edddae-646f-4900-a415-131c59791210') }}
                            </Checkbox>
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.All" :disabled="!waitingList"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('6d0211d9-5f66-4ac6-8412-b8b4b887765e') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('1eaf316b-a9b1-486f-8eb9-02a166c91d1c') }}
                        </p>

                        <p v-if="!waitingList" class="style-description-small">
                            {{ $t('f14b12c3-60f8-4444-ab1a-6cd86fbdd8ca') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :for="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)">
                        <template #left>
                            <Radio :id="WaitingListType.PreRegistrations" v-model="waitingListType" :value="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)"/>
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('60f30a3b-ec31-42ca-9a40-e39448f9568a') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('9580d49f-cb58-41c8-a339-1d21b67e25ed') }}
                        </p>

                        <p v-if="!registrationStartDate" class="style-description-small">
                            {{ $t('7edeb9ef-964b-4304-827a-27fff8997ae7') }}
                        </p>

                        <div v-if="waitingListType === WaitingListType.PreRegistrations" class="option">
                            <div class="split-inputs">
                                <STInputBox error-fields="settings.preRegistrationsDate" :error-box="errors.errorBox" :title="$t(`0378aa93-9655-4bac-822b-6e6c503e6573`)">
                                    <DateSelection v-model="preRegistrationsDate"/>
                                </STInputBox>

                                <TimeInput v-model="preRegistrationsDate" :validator="errors.validator" :title="$t(`cb8367e9-6497-483f-9d61-a595d1f5f441`)"/>
                            </div>

                            <Checkbox v-model="priorityForFamily">
                                {{ $t('438a893d-d84b-4079-b6ae-608b7b93a08d') }}
                            </Checkbox>
                        </div>
                    </STListItem>
                </STList>
            </template>

            <JumpToContainer v-if="patched.type === GroupType.Membership" class="container" :visible="forceShowRequireGroupIds || !!requireGroupIds.length">
                <GroupIdsInput v-model="requireGroupIds" :default-period-id="patched.periodId" :title="$t(`45ea18e0-dffa-44ea-a6a8-2cb2ce3ca29a`)"/>
            </JumpToContainer>

            <template v-if="$feature('member-trials')">
                <template v-if="patched.type === GroupType.Membership && (!defaultMembershipConfig || defaultMembershipConfig.trialDays)">
                    <hr><h2>{{ $t('8265d9e0-32c1-453c-ab2f-d31f1eb244c3') }}</h2>
                    <p>{{ $t('89a760d7-8995-458c-9635-da104971e95c') }}</p>

                    <STInputBox :title="$t('f0ceba51-bad2-4454-9a9b-4b12f0983c82')" error-fields="settings.trialDays" :error-box="errors.errorBox">
                        <NumberInput v-model="trialDays" suffix="dagen" suffix-singular="dag" :min="0" :max="defaultMembershipConfig?.trialDays ?? null"/>
                    </STInputBox>
                    <p v-if="defaultMembershipConfig && defaultMembershipConfig.trialDays" class="style-description-small">
                        {{ $t('d68a6d63-d782-49e2-84a5-4f77dbfa2977', {days: Formatter.days(defaultMembershipConfig.trialDays)}) }}
                    </p>

                    <STInputBox :title="$t('5ecd5e10-f233-4a6c-8acd-c1abff128a21')" error-fields="settings.startDate" :error-box="errors.errorBox">
                        <DateSelection v-model="startDate" :placeholder="formatDate(patched.settings.startDate, true)" :min="period?.startDate" :max="period?.endDate"/>
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('db636f2c-371d-4209-bd44-eaa6984c2813') }}
                    </p>
                </template>
            </template>

            <hr><h2>{{ $t('4fa037eb-6d01-4983-aa12-c642d01b1f83') }}</h2>
            <p>{{ $t('85230d87-fba2-4acb-9394-f489678f8055') }}</p>
            <p v-if="auth.hasFullAccess()" class="info-box">
                {{ $t('a8a8a0b0-c74c-4374-bf51-a85a9c605902') }}
            </p>
            <InheritedRecordsConfigurationBox :group-level="true" :override-organization="externalOrganization" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration"/>

            <hr><h2>{{ $t('2b8ed342-6e9b-4ffa-85cb-6a665fb9881b') }}</h2>
            <p>{{ $t('e02e1f2d-5b28-4a8e-8e8b-4d37af6f235f') }} <strong class="style-strong">{{ $t('c226101b-c183-4051-85d6-e5f0b687ae47') }}</strong> {{ $t('7c90f9d1-4776-4fad-9299-08c395dd2147') }}</p>

            <p class="warning-box">
                <span>
                    {{ $t('28bc0ab2-a546-4a2e-b0b7-f59342efb513') }} <strong class="style-strong style-underline">{{ $t('35c89e42-1155-4906-b7b3-0b5bdf004211') }}</strong> {{ $t('484adbe6-77d5-49c4-8793-6ad67439b693') }}
                </span>
            </p>

            <EditRecordCategoriesBox :categories="patched.settings.recordCategories" :settings="recordEditorSettings" @patch:categories="addRecordCategoriesPatch"/>
        </SaveView>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AgeInput, DateSelection, Dropdown, EditGroupView, EditRecordCategoriesBox, ErrorBox, GroupIdsInput, InheritedRecordsConfigurationBox, LoadingViewTransition, NumberInput, OrganizationAvatar, RecordEditorSettings, RecordEditorType, TimeInput, useRegisterItemFilterBuilders } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Country, DefaultAgeGroup, Group, GroupGenderType, GroupOption, GroupOptionMenu, GroupPrice, GroupSettings, GroupStatus, GroupType, OrganizationRecordsConfiguration, RecordCategory, Registration, WaitingListType, type MemberProperty } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import JumpToContainer from '../containers/JumpToContainer.vue';
import { useErrors } from '../errors/useErrors';
import { useAuth, useDraggableArray, useOrganization, usePatch, usePatchableArray, usePlatform } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import GroupOptionMenuBox from './components/GroupOptionMenuBox.vue';
import GroupOptionMenuView from './components/GroupOptionMenuView.vue';
import GroupPriceBox from './components/GroupPriceBox.vue';
import GroupPriceView from './components/GroupPriceView.vue';
import { useExternalOrganization, useFinancialSupportSettings, useRegistrationPeriod } from './hooks';

const props = withDefaults(
    defineProps<{
        group: Group;
        isMultiOrganization: boolean;
        isNew: boolean;
        saveHandler: (group: AutoEncoderPatchType<Group>) => Promise<void>;
        deleteHandler?: (() => Promise<void>) | null;
        showToasts?: boolean;
    }>(),
    {
        deleteHandler: null,
        showToasts: true,
        isMultiOrganization: false,
    },
);

const platform = usePlatform();
const organization = useOrganization();
const { patched, hasChanges, addPatch, patch } = usePatch(props.group);
const period = useRegistrationPeriod(computed(() => patched.value.periodId));
const forceShowRequireGroupIds = ref(false);
const usedStock = computed(() => patched.value.settings.getUsedStock(patched.value) || 0);
const auth = useAuth();

function addRequireGroupIds() {
    forceShowRequireGroupIds.value = true;
}

const { externalOrganization: externalOrganization, choose: chooseOrganizer, loading: loadingOrganizer, errorBox: loadingExternalOrganizerErrorBox } = useExternalOrganization(
    computed({
        get: () => patched.value.organizationId,
        set: (organizationId: string) => addPatch({
            organizationId,
        }),
    }),
);

const patchPricesArray = (prices: PatchableArrayAutoEncoder<GroupPrice>) => {
    addPatch({
        settings: GroupSettings.patch({
            prices,
        }),
    });
};

function addRecordCategoriesPatch(categories: PatchableArrayAutoEncoder<RecordCategory>) {
    addPatch({
        settings: GroupSettings.patch({
            recordCategories: categories,
        }),
    });
}

const { addPatch: addPricePatch, addPut: addPricePut, addDelete: addPriceDelete } = usePatchableArray(patchPricesArray);
const draggablePrices = useDraggableArray(() => patched.value.settings.prices, patchPricesArray);

const { addPatch: addOptionMenuPatch, addPut: addOptionMenuPut, addDelete: addOptionMenuDelete } = usePatchableArray((optionMenus: PatchableArrayAutoEncoder<GroupOptionMenu>) => {
    addPatch({
        settings: GroupSettings.patch({
            optionMenus,
        }),
    });
});

const recordsConfiguration = computed(() => patched.value.settings.recordsConfiguration);
const patchRecordsConfiguration = (recordsConfiguration: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
    addPatch({
        settings: GroupSettings.patch({
            recordsConfiguration,
        }),
    });
};
const inheritedRecordsConfiguration = computed(() => {
    return OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patched.value,
        includeGroup: false,
    });
});

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const pop = usePop();
const { priceName: reducedPriceName } = useFinancialSupportSettings({
    group: patched,
});
const present = usePresent();
const didSetAutomaticGroup = ref(false);

const availableWaitingLists = computed(() => {
    let base = externalOrganization?.value?.period?.groups.flatMap(g => g.waitingList ? [g.waitingList] : []) ?? [];

    // Replace patched waiting lists
    base = base.map((list) => {
        if (list.id === patched.value.waitingList?.id) {
            return patched.value.waitingList;
        }
        return list;
    });

    if (props.group.waitingList && props.group.waitingList.id !== patched.value.waitingList?.id) {
        base.push(props.group.waitingList);
    }

    // Add patched waiting list and the end, to maintain ordering
    if (patched.value.waitingList) {
        base.push(patched.value.waitingList);
    }

    // Remove duplicates (removing last one)
    base = base.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

    return base.map((list) => {
        const usedByGroups = externalOrganization?.value?.period?.groups.filter(g => g.waitingList?.id === list.id);
        return {
            list,
            description: usedByGroups?.length ? 'Deze wachtlijst wordt gebruikt door ' + Formatter.joinLast(usedByGroups.map(g => g.settings.name), ', ', ' en ') : 'Niet gebruikt',
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
    return defaultAgeGroups.value.find(g => g.id === patched.value.defaultAgeGroupId);
});

const name = computed({
    get: () => patched.value.settings.name,
    set: (name) => {
        addPatch({
            settings: GroupSettings.patch({
                name,
            }),
        });

        if ((!defaultAgeGroupId.value || didSetAutomaticGroup.value)) {
            const match = defaultAgeGroups.value.find(g => g.names.find(nn => StringCompare.typoCount(nn, name) === 0));
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
        if (patched.value.status !== GroupStatus.Open) {
            return GroupStatus.Closed;
        }

        if (useRegistrationStartDate.value) {
            if (registrationStartDate.value !== props.group.settings.registrationStartDate || (registrationStartDate.value && registrationStartDate.value > new Date())) {
                return 'RegistrationStartDate' as const;
            }
        }

        if (patched.value.status !== props.group.status) {
            return patched.value.status;
        }

        if (patched.value.closed && props.group.closed) {
            return GroupStatus.Closed;
        }

        return GroupStatus.Open;
    },
    set: (val) => {
        if (val === 'RegistrationStartDate') {
            addPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = true;

            if (patched.value.settings.registrationEndDate && patched.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Open) {
            addPatch({
                status: GroupStatus.Open,
            });
            useRegistrationStartDate.value = false;

            if (patched.value.settings.registrationEndDate && patched.value.settings.registrationEndDate.getTime() <= Date.now()) {
                addPatch({
                    settings: GroupSettings.patch({
                        registrationEndDate: null,
                    }),
                });
            }
            return;
        }

        if (val === GroupStatus.Closed) {
            addPatch({
                status: GroupStatus.Closed,
            });
        }
    },
});

const description = computed({
    get: () => patched.value.settings.description,
    set: description => addPatch({
        settings: GroupSettings.patch({
            description,
        }),
    }),
});

const minAge = computed({
    get: () => patched.value.settings.minAge,
    set: minAge => addPatch({
        settings: GroupSettings.patch({
            minAge,
        }),
    }),
});

const maxAge = computed({
    get: () => patched.value.settings.maxAge,
    set: maxAge => addPatch({
        settings: GroupSettings.patch({
            maxAge,
        }),
    }),
});

const genderType = computed({
    get: () => patched.value.settings.genderType,
    set: genderType => addPatch({
        settings: GroupSettings.patch({
            genderType,
        }),
    }),
});

const startDate = computed({
    get: () => patched.value.settings.startDate,
    set: startDate => addPatch({
        settings: GroupSettings.patch({
            startDate,
        }),
    }),
});

const requireGroupIds = computed({
    get: () => patched.value.settings.requireGroupIds,
    set: requireGroupIds => addPatch({
        settings: GroupSettings.patch({
            requireGroupIds: requireGroupIds as any,
        }),
    }),
});

const showAllowRegistrationsByOrganization = computed(() => props.isMultiOrganization || allowRegistrationsByOrganization.value);

const allowRegistrationsByOrganization = computed({
    get: () => patched.value.settings.allowRegistrationsByOrganization,
    set: allowRegistrationsByOrganization => addPatch({
        settings: GroupSettings.patch({
            allowRegistrationsByOrganization,
        }),
    }),
});

const type = computed(() => patched.value.type);

const defaultAgeGroupId = computed({
    get: () => patched.value.defaultAgeGroupId,
    set: (defaultAgeGroupId) => {
        addPatch({
            defaultAgeGroupId,
        });
        didSetAutomaticGroup.value = false;
    },
});

const waitingListType = computed({
    get: () => patched.value.settings.waitingListType,
    set: (waitingListType) => {
        addPatch({
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
    get: () => patched.value.settings.maxMembers,
    set: maxMembers => addPatch({
        settings: GroupSettings.patch({
            maxMembers,
        }),
    }),
});

const showEnableMaxMembers = computed(() => enableMaxMembers.value || type.value !== GroupType.WaitingList);

const enableMaxMembers = computed({
    get: () => patched.value.settings.maxMembers !== null,
    set: (enableMaxMembers) => {
        if (!enableMaxMembers) {
            addPatch({
                settings: GroupSettings.patch({
                    maxMembers: null,
                }),
            });
        }
        else {
            addPatch({
                settings: GroupSettings.patch({
                    maxMembers: props.group.settings.maxMembers ?? patched.value.settings.maxMembers ?? 200,
                }),
            });
        }
    },
});

const requirePlatformMembershipOnRegistrationDate = computed({
    get: () => patched.value.settings.requirePlatformMembershipOnRegistrationDate === true,
    set: (value: boolean) => {
        addPatch({
            settings: GroupSettings.patch({
                requirePlatformMembershipOnRegistrationDate: value,
            }),
        });
    },
});

const registrationStartDate = computed({
    get: () => patched.value.settings.registrationStartDate,
    set: registrationStartDate => addPatch({
        settings: GroupSettings.patch({
            registrationStartDate,
        }),
    }),
});

const registrationEndDate = computed({
    get: () => patched.value.settings.registrationEndDate,
    set: registrationEndDate => addPatch({
        settings: GroupSettings.patch({
            registrationEndDate,
        }),
    }),
});

const preRegistrationsDate = computed({
    get: () => patched.value.settings.preRegistrationsDate,
    set: preRegistrationsDate => addPatch({
        settings: GroupSettings.patch({
            preRegistrationsDate,
        }),
    }),
});

const priorityForFamily = computed({
    get: () => patched.value.settings.priorityForFamily,
    set: priorityForFamily => addPatch({
        settings: GroupSettings.patch({
            priorityForFamily,
        }),
    }),
});

const waitingList = computed({
    get: () => patched.value.waitingList,
    set: waitingList => addPatch({
        waitingList,
    }),
});

const trialDays = computed({
    get: () => patched.value.settings.trialDays,
    set: trialDays => addPatch({
        settings: GroupSettings.patch({
            trialDays,
        }),
    }),
});

const useRegistrationStartDate = computed({
    get: () => !!patched.value.settings.registrationStartDate,
    set: (useRegistrationStartDate) => {
        if (!useRegistrationStartDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: null,
                }),
            });
        }
        else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationStartDate: props.group.settings.registrationStartDate && props.group.settings.registrationStartDate > new Date() ? props.group.settings.registrationStartDate : new Date(Date.now() + 1000 * 60 * 60 * 24),
                }),
            });
        }
    },
});

const useRegistrationEndDate = computed({
    get: () => !!patched.value.settings.registrationEndDate,
    set: (useRegistrationEndDate) => {
        if (!useRegistrationEndDate) {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: null,
                }),
            });
        }
        else {
            addPatch({
                settings: GroupSettings.patch({
                    registrationEndDate: props.group.settings.registrationEndDate ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                }),
            });
        }
    },
});

const title = computed(() => {
    if (props.group.type === GroupType.WaitingList) {
        return props.isNew ? $t('5936be80-5f7a-429b-8bc2-7afdd47ff232') : $t('b3f49e49-2db8-46e3-8a9b-bc05a4b989c0');
    }

    if (props.group.type === GroupType.EventRegistration) {
        return props.isNew ? $t('bd6ad13b-be70-4d03-a1a0-3578786f4df3') : $t('8fd3a74f-5dae-4a7e-bcd3-7ac1da2e7e6c');
    }
    return props.isNew ? $t('c7944f69-c772-4cc5-b7c8-2ef96272dfe0') : $t('d886e927-86d1-48ed-93ed-60e924484db1');
});

const defaultMembershipTypeId = computed(() => defaultAgeGroup.value?.defaultMembershipTypeId ?? null);

const defaultMembership = computed(() => {
    return platform.value.config.membershipTypes.find(t => t.id === defaultMembershipTypeId.value);
});
const defaultMembershipConfig = computed(() => {
    return defaultMembership.value?.periods.get(patched.value.periodId);
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
            Toast.success($t('1e6b16bd-ca6e-49e2-9792-f8864a140d7b')).show();
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
    if (!await CenteredMessage.confirm(props.group.type === GroupType.EventRegistration ? $t('90ec517b-14e6-4436-8c91-fabac5c1bddf') : $t('11426f89-b2bf-4f7a-bd5a-a51c34e6aa96'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            Toast.success($t('eb66ea67-3c37-40f2-8572-9589d71ffab6')).show();
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
            name: $t('9b0aebaf-d119-49df-955b-eb57654529e5'),
            price: patched.value.settings.prices[0]?.price?.clone(),
        });

        await present({
            components: [
                new ComponentWithProperties(GroupPriceView, {
                    price,
                    group: patched,
                    isNew: true,
                    defaultMembershipTypeId,
                    showNameAlways: true,
                    saveHandler: async (patch: AutoEncoderPatchType<GroupPrice>) => {
                        addPricePut(price.patch(patch));
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
                price,
                group: patched,
                isNew: false,
                defaultMembershipTypeId,
                saveHandler: async (patch: AutoEncoderPatchType<GroupPrice>) => {
                    addPricePatch(patch);
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
        name: $t('9b0aebaf-d119-49df-955b-eb57654529e5'),
        options: [
            GroupOption.create({
                name: $t('82b0f786-db14-4a2c-8514-3ca3b28ac65f'),
            }),
        ],
    });

    await present({
        components: [
            new ComponentWithProperties(GroupOptionMenuView, {
                optionMenu,
                group: patched,
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
        organizationId: patched.value.organizationId,
        periodId: patched.value.periodId,
        type: GroupType.WaitingList,
        settings: GroupSettings.create({
            name: 'Wachtlijst van ' + patched.value.settings.name,
        }),
    });

    // Edit the group
    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                group: waitingList,
                isNew: true,
                showToasts: false,
                saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                    addPatch({
                        waitingList: waitingList.patch(patch),
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function isPropertyEnabled(name: MemberProperty) {
    return !!OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: externalOrganization.value,
        group: patched.value,
        includeGroup: true,
    })[name];
}

async function editWaitingList(waitingList: Group) {
    if (waitingList.id !== patched.value.waitingList?.id) {
        return;
    }

    await present({
        components: [
            new ComponentWithProperties(EditGroupView, {
                group: waitingList,
                isNew: false,
                showToasts: false,
                saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                    addPatch({
                        waitingList: patch,
                    });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const genderTypes = [
    {
        value: GroupGenderType.Mixed,
        name: 'Gemengd',
    },
    {
        value: GroupGenderType.OnlyFemale,
        name: 'Enkel meisjes',
    },
    {
        value: GroupGenderType.OnlyMale,
        name: 'Enkel jongens',
    },
];

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
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
        text = text + ' (niet automatisch)';
    }

    return text;
}

const getRegisterItemFilterBuilders = useRegisterItemFilterBuilders();

const recordEditorSettings = new RecordEditorSettings({
    type: RecordEditorType.Registration,
    dataPermission: false,
    toggleDefaultEnabled: false,
    filterBuilder: (recordCategories: RecordCategory[]) => {
        return getRegisterItemFilterBuilders(patched.value.patch({
            settings: GroupSettings.patch({
                recordCategories: recordCategories as any,
            }),
        }))[0];
    },
    exampleValue: Registration.create({
        group: patched.value,
        groupPrice: patched.value.settings.prices[0],
        organizationId: patched.value.organizationId,
    }),
});

defineExpose({
    shouldNavigateAway,
});

</script>
