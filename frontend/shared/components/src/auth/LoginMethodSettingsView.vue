<template>
    <SaveView
        :loading-view="loadingConfiguration"
        :loading="saving"
        :disabled="!hasChanges"
        :error-box="errors.errorBox"
        :title="$t('%1bP')"
        @save="save"
    >
        <h1>
            {{ title }}
        </h1>

        <p>
            {{
                description ??
                    $t(
                        "Configureer wie deze loginmethode mag gebruiken en hoe deze wordt weergegeven.",
                    )
            }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <Checkbox v-model="enabled">
            {{ $t("%1XW") }}
        </Checkbox>

        <template v-if="enabled">
            <template v-if="showDisplaySettings">
                <hr>
                <h2>{{ $t("%1Zb") }}</h2>

                <div class="split-inputs">
                    <div>
                        <STInputBox
                            error-fields="fullName"
                            :error-box="errors.errorBox"
                            :title="$t(`%10H`)"
                        >
                            <input
                                v-model="fullName"
                                class="input"
                                type="text"
                                autocomplete="off"
                                :placeholder="$t(`%14p`)"
                            >
                        </STInputBox>
                        <p class="style-description-small">
                            {{
                                $t(
                                    "De volledige naam wordt gebruikt op plaatsen waar er voldoende ruimte is, bijvoorbeeld in accountinstellingen.",
                                )
                            }}
                        </p>
                    </div>

                    <div>
                        <STInputBox
                            error-fields="shortName"
                            :error-box="errors.errorBox"
                            :title="$t(`%Zf`)"
                        >
                            <input
                                v-model="shortName"
                                class="input"
                                type="text"
                                autocomplete="off"
                                :placeholder="$t(`%14p`)"
                            >
                        </STInputBox>
                        <p class="style-description-small">
                            {{
                                $t(
                                    "De korte naam wordt gebruikt in compacte overzichten of wanneer de loginmethode kort benoemd moet worden.",
                                )
                            }}
                        </p>
                    </div>
                </div>

                <div class="split-inputs">
                    <div>
                        <STInputBox
                            error-fields="loginButtonText"
                            :error-box="errors.errorBox"
                            :title="$t(`%Zg`)"
                        >
                            <input
                                v-model="loginButtonText"
                                class="input"
                                type="text"
                                autocomplete="off"
                                :placeholder="$t(`%14p`)"
                            >
                        </STInputBox>
                        <p class="style-description-small">
                            {{
                                $t(
                                    "Deze tekst verschijnt op de knop waarmee bezoekers zich via deze loginmethode aanmelden.",
                                )
                            }}
                        </p>
                    </div>
                    <div v-if="provider" class="login-button-preview">
                        <STInputBox :title="$t(`%ID`)">
                            <LoginMethodButton
                                :config="patched"
                                :provider="provider"
                                :fallback-text="$t('%Zk')"
                                @click.prevent
                            />
                        </STInputBox>
                    </div>
                </div>
            </template>

            <template v-if="provider">
                <hr>
                <h2>{{ $t("%1Xk") }}</h2>

                <p>
                    {{ $t("%Zr") }}
                    <a
                        href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app"
                        target="_blank"
                        class="inline-link"
                    >{{ $t("%Zs") }}</a>
                    {{ $t("%Zt") }}
                </p>

                <STInputBox
                    error-fields="issuer"
                    :error-box="errors.errorBox"
                    class="max"
                    :title="$t(`%O`)"
                >
                    <input
                        v-model="issuer"
                        class="input"
                        type="text"
                        autocomplete="off"
                        :placeholder="$t(`%Zv`)"
                    >
                </STInputBox>

                <STInputBox
                    error-fields="clientId"
                    :error-box="errors.errorBox"
                    class="max"
                    :title="$t(`%1c`)"
                >
                    <input
                        v-model="clientId"
                        class="input"
                        type="text"
                        autocomplete="off"
                        :placeholder="$t(`%Zw`)"
                    >
                </STInputBox>

                <STInputBox
                    error-fields="clientSecret"
                    :error-box="errors.errorBox"
                    class="max"
                    :title="$t(`%1E`)"
                >
                    <input
                        v-model="clientSecret"
                        class="input"
                        type="text"
                        autocomplete="off"
                        :placeholder="$t(`%Zw`)"
                    >
                </STInputBox>

                <STInputBox
                    :error-box="errors.errorBox"
                    class="max"
                    :title="$t(`%n`)"
                >
                    <input
                        v-model="redirectUri"
                        :placeholder="defaultRedirectUri"
                        class="input"
                        type="text"
                        autocomplete="off"
                    ><template #right>
                        <button
                            v-copyable="redirectUri || defaultRedirectUri"
                            class="button icon copy small"
                            type="button"
                        />
                    </template>
                </STInputBox>
                <p class="style-description-small">
                    {{ $t("%Zu") }}
                </p>
                <div v-if="isDevelopment" class="info-box openid-dev-info">
                    <p>
                        {{
                            $t(
                                "Je kan lokaal snel een testprovider starten met Stamhoofd CLI. Het onderstaand commando zal de nodige gegevens printen om hierboven in te vullen. De redirect URI is al de standaardwaarde die je aan het commando moet meegeven.",
                            )
                        }}
                    </p>
                    <STInputBox class="max" :title="$t('%1c8')">
                        <input
                            :value="localSsoCommand"
                            class="input"
                            type="text"
                            readonly
                            autocomplete="off"
                        ><template #right>
                            <button
                                v-copyable="localSsoCommand"
                                class="button icon copy small"
                                type="button"
                            />
                        </template>
                    </STInputBox>
                </div>
            </template>

            <hr>
            <h2>{{ $t("%1Vf") }}</h2>

            <ArrayInput
                v-model="allowlist"
                :default-value="() => ''"
                :title="$t(`%Zh`)"
            >
                <template #item="{ index, modelValue, updateModelValue }">
                    <input
                        :value="modelValue"
                        class="input"
                        type="text"
                        :placeholder="$t(`%NE`) + ' ' + (index + 1)"
                        autocomplete="off"
                        @input="
                            updateModelValue(
                                ($event.target as HTMLInputElement).value || '',
                            )
                        "
                    >
                </template>

                <template #empty>
                    <p class="style-description-small">
                        {{ $t("%Za") }}
                    </p>
                </template>
            </ArrayInput>
            <p v-if="allowlist.length" class="style-description-small">
                {{ $t("%Zb") }}
            </p>

            <ArrayInput
                v-model="blocklist"
                :default-value="() => ''"
                :title="$t(`%Zi`)"
            >
                <template #item="{ index, modelValue, updateModelValue }">
                    <input
                        :value="modelValue"
                        class="input"
                        type="text"
                        :placeholder="$t(`%NE`) + ' ' + (index + 1)"
                        autocomplete="off"
                        @input="
                            updateModelValue(
                                ($event.target as HTMLInputElement).value || '',
                            )
                        "
                    >
                </template>

                <template #empty>
                    <p class="style-description-small">
                        {{ $t("%Zc") }}
                    </p>
                </template>
            </ArrayInput>
            <p class="style-description-small">
                {{ $t("%Zd") }}
            </p>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePatchMap } from '#hooks/usePatchMap.ts';
import ArrayInput from '#inputs/ArrayInput.vue';
import Checkbox from '#inputs/Checkbox.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import type {
    AutoEncoderPatchType,
    ConvertArrayToPatchableArray,
    Decoder,
    PartialWithoutMethods,
} from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { LoginMethod } from '@stamhoofd/structures';
import {
    LoginMethodConfig,
    LoginProviderType,
    OpenIDClientConfiguration,
} from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import LoginMethodButton from './LoginMethodButton.vue';

const props = withDefaults(
    defineProps<{
        loginMethod: LoginMethod;
        title: string;
        description?: string;
        configs: Map<LoginMethod, LoginMethodConfig>;
        saveHandler: (
            config: ConvertArrayToPatchableArray<
                Map<LoginMethod, LoginMethodConfig>
            >,
        ) => Promise<void>;
        provider?: LoginProviderType;
        showDisplaySettings?: boolean;
    }>(),
    {
        description: undefined,
        provider: undefined,
        showDisplaySettings: true,
    },
);

const errors = useErrors();
const pop = usePop();
const context = useContext();
const owner = useRequestOwner();
const organization = useOrganization();
const saving = ref(false);
const loadingConfiguration = ref(!!props.provider);
const ssoConfiguration = ref<OpenIDClientConfiguration | null>(null);

const {
    patch: configsPatch,
    patched: patchedConfigs,
    addPatch: addConfigsPatch,
    addPut: addConfigsPut,
    addDelete: addConfigsDelete,
    hasChanges: hasConfigChanges,
} = usePatchMap(props.configs);

const {
    patched: patchedOpenIdConfiguration,
    patch: openIdConfigurationPatch,
    hasChanges: hasOpenIdConfigurationChanges,
    addPatch: addOpenIdConfigurationPatch,
} = usePatch(
    computed(
        () => ssoConfiguration.value ?? OpenIDClientConfiguration.create({}),
    ),
);

const patched = computed(
    () =>
        patchedConfigs.value.get(props.loginMethod)
        ?? LoginMethodConfig.create({}),
);

onMounted(async () => {
    if (!props.provider) {
        return;
    }

    await loadConfiguration();
});

const enabled = computed({
    get: () => patchedConfigs.value.has(props.loginMethod),
    set: (value: boolean) => {
        if (value) {
            addConfigsPut(props.loginMethod, patched.value);
        } else {
            addConfigsDelete(props.loginMethod);
        }
    },
});

const shouldSaveOpenIdConfiguration = computed(
    () => !!props.provider && enabled.value,
);

const hasLoginMethodConfigChanges = computed(() => {
    const wasEnabled = props.configs.has(props.loginMethod);

    if (wasEnabled !== enabled.value) {
        return true;
    }

    return enabled.value && hasConfigChanges.value;
});

const hasChanges = computed(
    () =>
        hasLoginMethodConfigChanges.value
        || (shouldSaveOpenIdConfiguration.value && hasOpenIdConfigurationChanges.value),
);

function addPatch(
    patch: PartialWithoutMethods<AutoEncoderPatchType<LoginMethodConfig>>,
) {
    if (enabled.value) {
        addConfigsPatch(props.loginMethod, LoginMethodConfig.patch(patch));
        return;
    }

    addConfigsPut(
        props.loginMethod,
        patched.value.patch(LoginMethodConfig.patch(patch)),
    );
}

const loginButtonText = computed({
    get: () => patched.value.loginButtonText ?? '',
    set: loginButtonText =>
        addPatch({ loginButtonText: loginButtonText || null }),
});

const fullName = computed({
    get: () => patched.value.fullName ?? '',
    set: fullName => addPatch({ fullName: fullName || null }),
});

const shortName = computed({
    get: () => patched.value.shortName ?? '',
    set: shortName => addPatch({ shortName: shortName || null }),
});

const allowlist = computed({
    get: () => patched.value.allowlist,
    set: allowlist => addPatch({ allowlist: allowlist as any }),
});

const blocklist = computed({
    get: () => patched.value.blocklist,
    set: blocklist => addPatch({ blocklist: blocklist as any }),
});

const issuer = computed({
    get: () => patchedOpenIdConfiguration.value.issuer,
    set: (value: string) => addOpenIdConfigurationPatch({ issuer: value }),
});

const clientId = computed({
    get: () => patchedOpenIdConfiguration.value.clientId,
    set: (value: string) => addOpenIdConfigurationPatch({ clientId: value }),
});

const clientSecret = computed({
    get: () => patchedOpenIdConfiguration.value.clientSecret,
    set: (value: string) =>
        addOpenIdConfigurationPatch({ clientSecret: value }),
});

const redirectUri = computed({
    get: () => patchedOpenIdConfiguration.value.redirectUri ?? '',
    set: (value: string | null) =>
        addOpenIdConfigurationPatch({ redirectUri: value ? value : null }),
});

const defaultRedirectUri = computed(() => {
    if (organization.value) {
        return (
            'https://'
            + organization.value.id
            + '.'
            + STAMHOOFD.domains.api
            + '/openid/callback'
        );
    }
    return 'https://' + STAMHOOFD.domains.api + '/openid/callback';
});

const isDevelopment = computed(() => STAMHOOFD.environment === 'development');
const localSsoCommand = computed(
    () => `yarn stam sso start "${defaultRedirectUri.value}"`,
);

errors.validator.addValidation('openidConfiguration', () => {
    if (!shouldSaveOpenIdConfiguration.value) {
        return true;
    }

    const validationErrors = new SimpleErrors();

    if (issuer.value.trim() === '') {
        validationErrors.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Issuer is required',
            human: $t('%qt'),
            field: 'issuer',
        }));
    }

    if (clientId.value.trim() === '') {
        validationErrors.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Client ID is required',
            human: $t('%qt'),
            field: 'clientId',
        }));
    }

    if (clientSecret.value.trim() === '') {
        validationErrors.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Client secret is required',
            human: $t('%qt'),
            field: 'clientSecret',
        }));
    }

    if (validationErrors.errors.length === 0) {
        return true;
    }

    errors.errorBox = new ErrorBox(validationErrors);
    return false;
});

async function loadConfiguration() {
    loadingConfiguration.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/sso',
            query: {
                provider: props.provider ?? LoginProviderType.SSO,
            },
            decoder:
                OpenIDClientConfiguration as Decoder<OpenIDClientConfiguration>,
            owner,
            shouldRetry: true,
        });
        ssoConfiguration.value = response.data;
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loadingConfiguration.value = false;
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        if (!(await errors.validator.validate())) {
            saving.value = false;
            return;
        }

        if (hasLoginMethodConfigChanges.value) {
            await props.saveHandler(configsPatch.value);
        }

        if (shouldSaveOpenIdConfiguration.value && hasOpenIdConfigurationChanges.value) {
            await context.value.authenticatedServer.request({
                method: 'POST',
                path: '/sso',
                query: {
                    provider: props.provider,
                },
                decoder:
                    OpenIDClientConfiguration as Decoder<OpenIDClientConfiguration>,
                body: openIdConfigurationPatch.value,
                owner,
                shouldRetry: false,
            });
        }

        new Toast($t(`%HA`), 'success green').show();
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss" scoped>
.openid-dev-info {
    width: 100%;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .st-input-box {
        width: 100%;
    }
}

.login-button-preview-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
    gap: 15px;
    align-items: start;
}

.login-button-preview {
    padding-top: 0;
}

.login-button-preview h3 {
    margin: 0 0 5px;
    font-size: 15px;
    line-height: 18px;
    font-weight: 600;
}

@media (max-width: 700px) {
    .login-button-preview-row {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
