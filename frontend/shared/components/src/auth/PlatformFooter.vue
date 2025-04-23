<template>
    <div v-if="platform.config.footerText.html" class="legal-footer">
        <div>
            <aside class="style-wysiwyg gray subtle-links" v-html="platform.config.footerText.html" />
            <div>
                <button v-if="hasLanguages" type="button" class="button text" @click="switchLanguage">
                    <span class="icon language" />
                    <span>{{ LanguageHelper.getNativeName(I18nController.shared.language) }}</span>
                    <span class="icon arrow-down-small" />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { usePlatform } from '../hooks';
import { LanguageHelper } from '@stamhoofd/structures';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { useSwitchLanguage } from '../views/hooks/useSwitchLanguage';

const platform = usePlatform();
const { switchLanguage, hasLanguages } = useSwitchLanguage();
</script>
