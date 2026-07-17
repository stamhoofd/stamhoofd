<template>
    <template v-if="languages.length > 1 || (supportsTranslations && hasLanguages && translationsEnabled)">
        <button v-if="!modelValue" class="button icon translate" type="button" :disabled="disabled" data-testid="email-language-button" @click="showMenu" />
        <button v-else class="button text" type="button" :disabled="disabled" data-testid="email-language-button" @click="showMenu">
            <span class="icon translate" />
            <span>{{ LanguageHelper.getName(modelValue) }}</span>
            <span class="icon arrow-down-small" />
        </button>
    </template>
</template>

<script setup lang="ts">
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { LanguageHelper } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';
import { useEmailTranslationsEnabled } from './hooks/useEmailTranslationsEnabled';

const props = withDefaults(defineProps<{
    /**
     * Languages that exist on the content: the default language (if set) and every translation
     */
    languages: Language[];

    /**
     * The language of the default content, null when the content is untranslated
     */
    defaultLanguage: Language | null;

    /**
     * Whether new translations can be added: only the case when the language of the recipients
     * is known. Existing translations remain manageable regardless.
     */
    supportsTranslations: boolean;
    disabled?: boolean;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    add: [language: Language];
    remove: [language: Language];
}>();

/**
 * The language that is currently being edited (null = no language set on the content)
 */
const modelValue = defineModel<Language | null>({ required: true });
const { hasLanguages } = useSwitchLanguage();
const translationsEnabled = useEmailTranslationsEnabled();

async function showMenu(event: MouseEvent) {
    const groups: ContextMenuItem[][] = [];
    const canAdd = props.supportsTranslations && translationsEnabled.value;
    const listedLanguages = canAdd ? [...new Set([...I18nController.shared.availableLanguages, ...props.languages])] : [...props.languages];

    if (props.defaultLanguage === null || props.languages.length === 0) {
        // Only without a language: once a language is set, the default content is that language
        groups.push([
            new ContextMenuItem({
                name: $t('%Zdx'),
                disabled: true,
                action: () => {
                    modelValue.value = null;
                },
            }),
        ]);

        groups.push([
            new ContextMenuItem({
                name: $t('%ZeB'),
                childMenu: new ContextMenu([
                    listedLanguages.map((language) => {
                        const exists = props.languages.includes(language);
                        const isCurrent = modelValue.value === language;

                        return new ContextMenuItem({
                            name: LanguageHelper.getName(language),
                            action: () => {
                                if (!exists) {
                                    emit('add', language);
                                    return;
                                }
                                if (!isCurrent) {
                                    modelValue.value = language;
                                    return;
                                }
                                emit('remove', language);
                            },
                        });
                    }),
                ]),
            }),
        ]);
    } else {
        // Languages without a translation can only be added when adding translations is allowed

        // Existing languages first
        groups.push(props.languages.map((language) => {
            const isCurrent = modelValue.value === language;
            const isDefault = props.defaultLanguage === language;

            return new ContextMenuItem({
                name: LanguageHelper.getName(language),
                selected: isCurrent,
                rightText: (isDefault && props.languages.length > 1 ? $t('%v6') : ''),
                action: () => {
                    if (!isCurrent) {
                        modelValue.value = language;
                        return;
                    }
                },
            });
        }));

        const untranslatedLanguages = listedLanguages.filter(l => !props.languages.includes(l));

        const group: ContextMenuItem[] = [];

        if (untranslatedLanguages.length) {
            group.push(
                new ContextMenuItem({
                    name: $t('%Zds'),
                    icon: 'plus',
                    childMenu: new ContextMenu([
                        untranslatedLanguages.map((language) => {
                            return new ContextMenuItem({
                                name: LanguageHelper.getName(language),
                                action: () => {
                                    emit('add', language);
                                },
                            });
                        }),
                    ]),
                }),
            );
        }

        if (props.languages.length === 1) {
            group.push(
                new ContextMenuItem({
                    name: $t('%Ze5'),
                    icon: 'trash',
                    destructive: true,
                    action: () => {
                        emit('remove', props.languages[0]);
                    },
                }),
            );
        } else {
            group.push(
                new ContextMenuItem({
                    name: $t('%ZeE'),
                    icon: 'trash',
                    destructive: true,
                    childMenu: new ContextMenu([
                        props.languages.map((language) => {
                            return new ContextMenuItem({
                                name: LanguageHelper.getName(language),
                                action: () => {
                                    emit('remove', language);
                                },
                            });
                        }),
                    ]),
                }),
            );
        }
        if (group.length) {
            groups.push(group);
        }
    }

    const menu = new ContextMenu(groups);
    await menu.show({
        button: event.currentTarget as HTMLButtonElement,
    });
}
</script>
