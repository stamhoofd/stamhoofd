<template>
    <LoadingViewTransition :error-box="loadingExternalOrganizerErrorBox">
        <SaveView v-if="!loadingOrganizer && patchedPeriod" :loading="saving" :title="title" :disabled="!hasChanges && !isNew" class="group-edit-view" :deleting="deleting" @save="save" v-on="!isNew ? {delete: deleteMe} : {}">
            <h1>
                {{ title }}

                <span v-if="patchedGroup.settings.period && patchedGroup.settings.period.id !== patchedPeriod.period.id" class="title-suffix">
                    {{ patchedGroup.settings.period.nameShort }}
                </span>
            </h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <template v-if="type === GroupType.Membership">
                <p v-if="isNew" class="info-box">
                    {{ $t('f82d0296-c037-4e8b-9150-08cfe8c8f231') }}
                </p>

                <div class="split-inputs">
                    <TInput v-model="name" :placeholder="$t(`feeb5e82-d955-47f1-9f1d-6012ac9bc310`)" error-fields="settings.name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)" />

                    <STInputBox v-if="defaultAgeGroupsFiltered.length" :title="$t('528545c4-028b-4711-9b16-f6fa990c3130')" error-fields="settings.defaultAgeGroupId" :error-box="errors.errorBox">
                        <Dropdown v-model="defaultAgeGroupId">
                            <option :value="null">
                                {{ $t('086196b7-52df-4110-955a-b437ed924aa0') }}
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
                    <TInput v-model="name" :placeholder="$t(`1612603d-bc69-44b2-a899-6905ee46d2c7`)" error-fields="settings.name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)" />
                </div>
            </template>

            <TTextarea v-model="description" :placeholder="$t(`706063e0-e92f-4fdd-8b88-8dea252a55cc`)" error-fields="settings.description" :error-box="errors.errorBox" class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)" />
            <p v-if="patchedGroup.type === GroupType.EventRegistration" class="style-description-small">
                {{ $t('a20a78e9-60c4-425b-a416-5874d0ec4b11') }}
            </p>

            <STList v-if="nonPatchedGroup.settings.hasCustomDates">
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="hasCustomDates" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('d35a173c-5d80-48d6-a83b-5274f883a950') }}
                    </h3>

                    <template v-if="hasCustomDates">
                        <div class="split-inputs option" @click.stop.prevent>
                            <STInputBox :title="$t('bf07a716-4f44-4534-81a9-a278532b7632')" error-fields="settings.startDate" :error-box="errors.errorBox">
                                <DateSelection v-model="startDate" :placeholder-date="patchedGroup.settings.startDate" />
                            </STInputBox>
                            <TimeInput v-model="startDate" :validator="errors.validator" :title="$t('5a3e25de-683f-4a20-b02e-ebcc3aca89f6')" />
                        </div>

                        <div class="split-inputs option" @click.stop.prevent>
                            <STInputBox :title="$t('78e69db3-b94b-47b7-8398-940a204f485e')" error-fields="settings.endDate" :error-box="errors.errorBox">
                                <DateSelection v-model="endDate" :placeholder-date="patchedGroup.settings.endDate" :min="startDate" />
                            </STInputBox>
                            <TimeInput v-model="endDate" :validator="errors.validator" :title="$t('5a3e25de-683f-4a20-b02e-ebcc3aca89f6')" />
                        </div>
                    </template>
                </STListItem>
            </STList>

            <template v-if="patchedGroup.type === GroupType.EventRegistration && isMultiOrganization">
                <hr><h2>{{ $t('55e86a73-d637-4ca0-82ac-abd27d60705f') }}</h2>
                <p>{{ $t('e1c25751-832f-455b-a5dd-a1b30b742433') }}</p>
                <p class="style-description-block">
                    {{ $t('5fa1e94a-98fc-4d9d-a7f9-440d35d2e923') }}
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
                    <div>{{ $t('0fb1a3a9-4ced-4097-b931-e865b3173cf9') }}</div>
                    <div>
                        <button class="button text only-icon-smartphone" type="button" @click="addGroupPrice">
                            <span class="icon add" />
                            <span>{{ $t('a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc') }}</span>
                        </button>
                    </div>
                </h2>
                <p>{{ $t("de2222d9-c934-4d06-8702-9527686de012") }}</p>

                <STList v-if="patchedGroup.settings.prices.length !== 1" v-model="draggablePrices" :draggable="true">
                    <template #item="{item: price}">
                        <STListItem :selectable="true" class="right-stack" @click="editGroupPrice(price)">
                            <h3 class="style-title-list">
                                {{ price.name }}
                            </h3>

                            <p class="style-description-small">
                                {{ $t('52bff8d2-52af-4d3f-b092-96bcfa4c0d03') }}: {{ formatPrice(price.price.price) }}
                            </p>

                            <p v-if="price.price.reducedPrice !== null" class="style-description-small">
                                {{ reducedPriceName }}: <span>{{ formatPrice(price.price.reducedPrice) }}</span>
                            </p>

                            <p v-if="price.startDate" class="style-description-small">
                                {{ $t('761ba5a0-8f9b-4c87-b3d0-559e3f6e8d92', {date: formatStartDate(price.startDate)}) }}
                            </p>
                            <p v-if="price.endDate" class="style-description-small">
                                {{ $t('543f5147-f7a5-430b-9b20-b974e809627d', {date: formatEndDate(price.endDate)}) }}
                            </p>

                            <p v-for="[id, discount] of price.bundleDiscounts" :key="id" class="style-description-small">
                                <span class="icon small label" /><span>{{ discount.name.toString() }}</span>
                            </p>

                            <p v-if="price.isSoldOut(patchedGroup)" class="style-description-small">
                                {{ $t('44ba544c-3db6-4f35-b7d1-b63fdcadd9ab') }}
                            </p>
                            <p v-else-if="price.stock" class="style-description-small">
                                {{ $t('dceceb1c-6d55-4a93-bf8f-85ba041786f4', {stock: pluralText(price.getRemainingStock(patchedGroup) ?? 0, 'stuk', 'stuks')}) }}
                            </p>

                            <template #right>
                                <span v-if="price.hidden" :v-tooltip="$t('aff982ed-0f1a-4838-af79-9e00cd53131b')" class="icon gray eye-off" />
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
                        {{ $t('5473e2ee-81da-4671-922d-546548041f26') }}
                    </h3>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('1a1f32bb-9469-43ca-a254-3018e07cbcc1') }}</h2>
            <p>{{ $t('87722045-cb82-4f5d-b910-122d52bd193e') }}</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" :value="GroupStatus.Closed" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('ae8d3a27-6a56-4ae8-ada6-c843f01625b0') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('a83a23f9-7689-4ad7-9f29-dde62e434e8b') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" value="RegistrationStartDate" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('160b9fb1-c214-43bb-9810-f5f5ccdac069') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('66c7d6ba-46ab-4f87-a26f-d59c3405c76d') }}
                    </p>

                    <div v-if="virtualOpenStatus === 'RegistrationStartDate'" class="split-inputs option" @click.stop.prevent>
                        <STInputBox :title="$t('4f7cef46-0b46-4225-839e-510d8a8b95bc')" error-fields="settings.registrationStartDate" :error-box="errors.errorBox">
                            <DateSelection v-model="registrationStartDate" />
                        </STInputBox>
                        <TimeInput v-if="registrationStartDate" v-model="registrationStartDate" :title="$t('1e43813a-f48e-436c-bb49-e9ebb0f27f58')" :validator="errors.validator" />
                    </div>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Radio v-model="virtualOpenStatus" :value="GroupStatus.Open" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('cd0a1bf5-5cfe-40c6-bbd1-9f40574d559b') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('645cf106-ee22-40a6-9d43-fcfb812b2351') }}
                    </p>
                </STListItem>

                <STListItem v-if="virtualOpenStatus !== GroupStatus.Closed" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useRegistrationEndDate" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('fd378bac-7d3d-4932-b511-851078805aff') }}
                    </h3>

                    <div v-if="useRegistrationEndDate" class="split-inputs option" @click.stop.prevent>
                        <STInputBox :title="$t('6905dd1f-fe82-4ddc-bc6c-9ad496d34a71')" error-fields="settings.registrationEndDate" :error-box="errors.errorBox">
                            <DateSelection v-model="registrationEndDate" />
                        </STInputBox>
                        <TimeInput v-if="registrationEndDate" v-model="registrationEndDate" :title="$t('1617abfe-8657-4a9f-9fe3-6e6d896c4ef6')" :validator="errors.validator" />
                    </div>
                </STListItem>
            </STList>

            <div v-if="patchedGroup.type === GroupType.Membership" class="container">
                <hr><h2>{{ $t('ca2235bb-f789-4859-899b-03c1d1ac2684') }}</h2>

                <template v-if="isPropertyEnabled('birthDay')">
                    <div class="split-inputs">
                        <STInputBox error-fields="settings.minAge" :error-box="errors.errorBox" :title="$t(`7d708b33-f1a6-4b95-b0a7-717a8e5a9e07`)">
                            <AgeInput v-model="minAge" :year="patchedGroup.settings.startDate.getFullYear()" :nullable="true" :placeholder="$t(`f5f56168-1922-4a23-b376-20a7738bfa66`)" />
                        </STInputBox>

                        <STInputBox error-fields="settings.maxAge" :error-box="errors.errorBox" :title="$t(`c0cab705-c129-4a72-8860-c33ef91ec630`)">
                            <AgeInput v-model="maxAge" :year="patchedGroup.settings.startDate.getFullYear()" :nullable="true" :placeholder="$t(`f5f56168-1922-4a23-b376-20a7738bfa66`)" />
                        </STInputBox>
                    </div>
                    <p class="style-description-small">
                        *{{ $t('912639c7-e301-463e-b2d3-16b912848330') }}{{ patchedGroup.settings.startDate.getFullYear() }}.<template v-if="externalOrganization?.address.country === Country.Belgium">
                            {{ $t('49030aa4-f77c-4db5-b976-2125675aae66') }}
                        </template>
                    </p>
                </template>

                <STInputBox v-if="isPropertyEnabled('gender')" error-fields="genderType" :error-box="errors.errorBox" class="max" :title="$t(`9d766e89-0e75-491a-9207-d86cd7757263`)">
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

                <STInputBox v-if="requirePlatformMembershipOnRegistrationDate || (!defaultAgeGroupId)" error-fields="requirePlatformMembershipOnRegistrationDate" :error-box="errors.errorBox" class="max" :title="$t(`c0277e8e-a2e0-4ec3-9339-c2e1be2e6e2d`)">
                    <STList>
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="requirePlatformMembershipOnRegistrationDate" />
                            </template>

                            <h3 class="style-title-list">
                                {{ $t('b0d2d30a-f641-473a-91c7-4ab2297f25b1') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('272cfcc9-e917-4e74-8952-076b8f2e8b23') }}
                            </p>
                        </STListItem>
                    </STList>
                </STInputBox>

                <button v-if="requireGroupIds.length === 0" type="button" class="button text" @click="addRequireGroupIds">
                    <span class="icon add" />
                    <span>{{ $t('e7319239-1924-462c-bdfb-b9a29d875c41') }}</span>
                </button>

                <button v-if="preventGroupIds.length === 0" type="button" class="button text" @click="addPreventGroupIds">
                    <span class="icon add" />
                    <span>{{ $t('7ee15d1f-e8bd-4100-900b-1ff69dc7c857') }}</span>
                </button>
            </div>

            <div v-if="showAllowRegistrationsByOrganization || showEnableMaxMembers" class="container">
                <hr><h2>{{ $t('bf2af52c-de5d-4089-b46d-9be48594cdb4') }}</h2>
                <STList>
                    <template v-if="isMultiOrganization">
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('7aa7f71d-cd2c-4fb4-b4e6-4085738c1e60') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('9dc28ec0-750c-464e-95f1-fa55b7cf3390') }}
                            </p>
                        </STListItem>

                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowViewRegistrations" :disabled="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t(`ddb211ab-2e6b-4a8c-9f05-5c18d16c911c`) }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('f968eadd-511c-4bb7-ba95-26062633abc0') }}
                            </p>
                        </STListItem>

                        <STListItem v-if="allowRegistrationsByOrganization" :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="sendConfirmationEmailForManualRegistrations" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('1383a10a-2804-4102-b583-ba13d35f3ca4') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('027bed5e-9c4b-43d2-85d4-06925be61a12') }}
                            </p>
                        </STListItem>
                    </template>
                    <template v-else-if="showAllowRegistrationsByOrganization">
                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowViewRegistrations" :disabled="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t(`a641a313-6916-4747-ba44-43d4df6d477f`) }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('f968eadd-511c-4bb7-ba95-26062633abc0') }}
                            </p>
                        </STListItem>

                        <STListItem :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox v-model="allowRegistrationsByOrganization" />
                            </template>
                            <h3 class="style-title-list">
                                {{ $t(`025ccb96-96ec-441f-9992-13668e1758ec`) }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('fb540a87-1191-4e51-b53a-5f63f1b28d5c') }}
                            </p>
                        </STListItem>
                    </template>

                    <STListItem v-if="showEnableMaxMembers" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="enableMaxMembers" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('cbe0f7dd-5a88-44a9-8876-2d39f8c8ef10', {stock: usedStock.toString()}) }}
                        </h3>
                        <div v-if="enableMaxMembers" class="option" @click.stop.prevent>
                            <STInputBox title="" error-fields="maxMembers" :error-box="errors.errorBox">
                                <NumberInput v-model="maxMembers" :min="0" suffix="leden" suffix-singular="lid" />
                            </STInputBox>
                            <p class="style-description-small">
                                {{ $t('13839d7e-2260-4ded-945f-02e4479ef0d5') }}
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </div>

            <div v-if="type === GroupType.Membership || type === GroupType.EventRegistration || waitingList" class="container">
                <hr><h2>{{ $t('a56bcf08-214d-421b-9cc0-336d2b5ab0ea') }}</h2>
                <p>{{ $t('fb860b93-1b92-43ba-9e3d-1f6573725f23') }}</p>
                <p class="style-description-block">
                    {{ $t('bb4aa0a1-3f9e-4ce6-9ef6-f775577967c9') }}
                </p>

                <STList v-if="availableWaitingLists.length">
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingList" :value="null" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('3e21b640-2f5e-40c6-95f2-0f8e9c99ab30') }}
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
                    {{ $t('cea2cd4c-3023-40e1-b8f4-8ca9bedc9af8') }}
                </p>

                <p class="style-button-bar">
                    <button type="button" class="button text" @click="addWaitingList">
                        <span class="icon add" />
                        <span>{{ $t('58649f04-8b21-43ba-9193-3fd3eb02b5ef') }}</span>
                    </button>
                </p>
            </div>

            <template v-if="waitingListType !== WaitingListType.None || (enableMaxMembers && type === GroupType.Membership)">
                <hr><h2>{{ $t('30457887-ca28-427f-b3ab-b3943e73a54b') }}</h2>
                <p>{{ $t('9a8ee414-0dc9-4625-ab6b-d4ad8129c280') }}</p>

                <p v-if="waitingListType === WaitingListType.PreRegistrations || waitingListType === WaitingListType.ExistingMembersFirst" class="info-box">
                    {{ $t('e2130593-e64d-4f3a-bb16-75ba4ed7604e') }}
                </p>

                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.None" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('d98e42dc-ac06-40af-b28b-c33d03319558') }}
                        </h3>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.ExistingMembersFirst" :disabled="!waitingList" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('4fdfb0bb-c68b-4966-bfe0-a08bbd13da6b') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('1eade60b-8648-403f-ac80-97300c48fee7') }}
                        </p>

                        <p v-if="!waitingList" class="style-description-small">
                            {{ $t('fce84097-5cb4-4c49-bbcd-6a13b954cd72') }}
                        </p>

                        <div v-if="waitingListType === WaitingListType.ExistingMembersFirst" class="option">
                            <Checkbox v-model="priorityForFamily">
                                {{ $t('8fd194c8-d490-40be-8fdc-acf0113d1d74') }}
                            </Checkbox>
                        </div>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :disabled="!waitingList">
                        <template #left>
                            <Radio v-model="waitingListType" :value="WaitingListType.All" :disabled="!waitingList" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('0f3bcf65-6d8d-4ba3-81ff-6b85885eb88f') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('86165fe1-6bd8-4af4-8213-3158be8dad35') }}
                        </p>

                        <p v-if="!waitingList" class="style-description-small">
                            {{ $t('fce84097-5cb4-4c49-bbcd-6a13b954cd72') }}
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label" :for="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)">
                        <template #left>
                            <Radio :id="WaitingListType.PreRegistrations" v-model="waitingListType" :value="WaitingListType.PreRegistrations" :disabled="(!registrationStartDate)" />
                        </template>

                        <h3 class="style-title-list">
                            {{ $t('98dad67a-cd2c-44a4-b94e-bf7a97546046') }}
                        </h3>

                        <p class="style-description-small">
                            {{ $t('db6e4b14-0559-49ae-9239-8718f35c8837') }}
                        </p>

                        <p v-if="!registrationStartDate" class="style-description-small">
                            {{ $t('a6306aac-e1a5-41aa-9933-d740084a4d54') }}
                        </p>

                        <div v-if="waitingListType === WaitingListType.PreRegistrations" class="option">
                            <div class="split-inputs">
                                <STInputBox error-fields="settings.preRegistrationsDate" :error-box="errors.errorBox" :title="$t(`3ec503e3-ac1d-41be-bef3-cfa2b9de548a`)">
                                    <DateSelection v-model="preRegistrationsDate" />
                                </STInputBox>

                                <TimeInput v-model="preRegistrationsDate" :validator="errors.validator" :title="$t(`22761311-3065-49fd-82ca-bc60aae3c975`)" />
                            </div>

                            <Checkbox v-model="priorityForFamily">
                                {{ $t('29fcc704-c030-4488-a9bc-dfb66b9fcb81') }}
                            </Checkbox>
                        </div>
                    </STListItem>
                </STList>
            </template>

            <JumpToContainer v-if="patchedGroup.type === GroupType.Membership" class="container" :visible="forceShowRequireGroupIds || !!requireGroupIds.length">
                <GroupIdsInput v-model="requireGroupIds" :default-period-id="patchedGroup.periodId" :title="$t(`52c3975b-4d59-4293-9ad6-993d18982d89`)" />
            </JumpToContainer>

            <JumpToContainer v-if="patchedGroup.type === GroupType.Membership" class="container" :visible="forceShowPreventGroupIds || !!preventGroupIds.length">
                <GroupIdsInput v-model="preventGroupIds" :default-period-id="patchedGroup.periodId" :title="$t('7ee15d1f-e8bd-4100-900b-1ff69dc7c857')" />
            </JumpToContainer>

            <template v-if="$feature('member-trials')">
                <template v-if="patchedGroup.type === GroupType.Membership && (!defaultMembershipConfig || defaultMembershipConfig.trialDays)">
                    <hr><h2>{{ $t('8265d9e0-32c1-453c-ab2f-d31f1eb244c3') }}</h2>
                    <p>{{ $t('89a760d7-8995-458c-9635-da104971e95c') }}</p>

                    <STInputBox :title="$t('f0ceba51-bad2-4454-9a9b-4b12f0983c82')" error-fields="settings.trialDays" :error-box="errors.errorBox">
                        <NumberInput v-model="trialDays" suffix="dagen" suffix-singular="dag" :min="0" :max="defaultMembershipConfig?.trialDays ?? null" />
                    </STInputBox>
                    <p v-if="defaultMembershipConfig && defaultMembershipConfig.trialDays" class="style-description-small">
                        {{ $t('d68a6d63-d782-49e2-84a5-4f77dbfa2977', {days: Formatter.days(defaultMembershipConfig.trialDays)}) }}
                    </p>

                    <template v-if="!hasCustomDates">
                        <STInputBox :title="$t('5ecd5e10-f233-4a6c-8acd-c1abff128a21')" error-fields="settings.startDate" :error-box="errors.errorBox">
                            <DateSelection v-model="startDate" :placeholder-date="patchedGroup.settings.startDate" :min="patchedPeriod.period.startDate" :max="patchedPeriod.period.endDate" />
                        </STInputBox>

                        <p class="style-description-small">
                            {{ $t('db636f2c-371d-4209-bd44-eaa6984c2813') }}
                        </p>
                    </template>
                    <p v-else-if="trialDays && patchedGroup.settings.startDate.getTime() !== patchedPeriod.period.startDate.getTime()" class="info-box">
                        {{ $t('5fe368ac-80c1-4ea3-a148-27ebbb825870', {start: Formatter.date(patchedGroup.settings.startDate)}) }}
                    </p>
                </template>
            </template>

            <hr><h2>{{ $t('5319e68a-c4fd-45e9-a6b0-f85d28cf4d85') }}</h2>
            <p>{{ $t('53aa228f-3c36-49d7-be11-5819b34308d6') }}</p>
            <p v-if="auth.hasFullAccess()" class="info-box">
                {{ $t('e730fb63-3f7a-4322-84e7-e9fc6e1d7f64') }}
            </p>
            <InheritedRecordsConfigurationBox :group-level="true" :override-organization="externalOrganization" :inherited-records-configuration="inheritedRecordsConfiguration" :records-configuration="recordsConfiguration" @patch:records-configuration="patchRecordsConfiguration" />

            <hr><h2>{{ $t('c94914a3-d4dd-40e9-b512-77394a5aae76') }}</h2>
            <p>{{ $t('fd68ec93-bdab-4c08-b9c7-34757150259a') }} <strong class="style-strong">{{ $t('174038c4-9ee3-413f-8831-370eb9a12413') }}</strong> {{ $t('73acbb7e-5bd3-4e9b-9721-3300de84e32a') }}</p>

            <p class="warning-box">
                <span>
                    {{ $t('af24b3e3-a379-479f-af8c-77228f1d6128') }} <strong class="style-strong style-underline">{{ $t('0c1a631e-b817-4b8e-98ad-97e82443c0be') }}</strong> {{ $t('dc8532ed-b773-40ad-8d3b-c2095c95e42b') }}
                </span>
            </p>

            <EditRecordCategoriesBox :categories="patchedGroup.settings.recordCategories" :settings="recordEditorSettings" @patch:categories="addRecordCategoriesPatch" />
        </SaveView>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AgeInput, DateSelection, Dropdown, EditGroupView, EditRecordCategoriesBox, ErrorBox, GroupIdsInput, InheritedRecordsConfigurationBox, LoadingViewTransition, NumberInput, OrganizationAvatar, RecordEditorSettings, RecordEditorType, TimeInput, useRegisterItemFilterBuilders, useValidation } from '@stamhoofd/components';
import { BooleanStatus, Country, DefaultAgeGroup, Group, GroupGenderType, GroupOption, GroupOptionMenu, GroupPrice, GroupPrivateSettings, GroupSettings, GroupStatus, GroupType, MemberDetails, MemberWithRegistrationsBlob, Organization, OrganizationRecordsConfiguration, OrganizationRegistrationPeriod, Platform, PlatformFamily, PlatformMember, RecordCategory, RegisterItem, TranslatedString, WaitingListType, type MemberProperty } from '@stamhoofd/structures';
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
        let d = usedByGroups?.length ? $t(`4f6627be-b20b-48b0-a2f7-8fc68d2465b2`, { groupNames: Formatter.joinLast(usedByGroups.map(g => g.settings.name.toString()), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ') }) : $t(`daef5a57-e4f0-41f4-b05f-7946913947ef`);
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
        return props.isNew ? $t('5936be80-5f7a-429b-8bc2-7afdd47ff232') : $t('b3f49e49-2db8-46e3-8a9b-bc05a4b989c0');
    }

    if (patchedGroup.value.type === GroupType.EventRegistration) {
        return props.isNew ? $t('bd6ad13b-be70-4d03-a1a0-3578786f4df3') : $t('8fd3a74f-5dae-4a7e-bcd3-7ac1da2e7e6c');
    }
    return props.isNew ? $t('c7944f69-c772-4cc5-b7c8-2ef96272dfe0') : $t('d886e927-86d1-48ed-93ed-60e924484db1');
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
    if (!await CenteredMessage.confirm(patchedGroup.value.type === GroupType.EventRegistration ? $t('90ec517b-14e6-4436-8c91-fabac5c1bddf') : $t('11426f89-b2bf-4f7a-bd5a-a51c34e6aa96'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'))) {
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
            name: TranslatedString.create($t('9b0aebaf-d119-49df-955b-eb57654529e5')),
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
            name: TranslatedString.create($t(`c1f1d9d0-3fa1-4633-8e14-8c4fc98b4f0f`) + ' ' + patchedGroup.value.settings.name.toString()),
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

function isPropertyEnabled(name: MemberProperty) {
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
        name: $t(`905afd18-5e9a-4d30-9040-646d29b25c15`),
    },
    {
        value: GroupGenderType.OnlyFemale,
        name: $t(`95e8c4b3-a548-4689-b581-88d346ee4e7b`),
    },
    {
        value: GroupGenderType.OnlyMale,
        name: $t(`91ec0ba0-1840-4246-b804-27eb3cda67e3`),
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
        text = text + ' ' + $t(`bf9acd2b-f2d4-42df-8d13-6af97648eb27`);
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
                firstName: $t(`fbe32760-d352-4d3d-813c-acd50f3cba50`),
                lastName: $t(`946f5e2e-d92c-4bbd-b64f-115958a04d01`),
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
