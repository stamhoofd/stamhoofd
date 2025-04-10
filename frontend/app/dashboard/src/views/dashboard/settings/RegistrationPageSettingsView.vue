<template>
    <div id="registration-page-settings-view" class="st-view background">
        <STNavigationBar :title="$t(`Jullie ledenportaal`)" />

        <main>
            <h1>{{ $t('Jullie ledenportaal') }}</h1>

            <p class="style-description">
                {{ $t('3e94193d-873b-4770-ba03-5f7528debf2c') }}
            </p>

            <hr><h2 class="style-with-button">
                <div>{{ $t('Jullie ledenportaal') }}</div>
                <div>
                    <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                        <span class="icon external" />
                        <span class="hide-small">{{ $t('Openen') }}</span>
                    </a>
                </div>
            </h2>

            <input :v-tooltip="$t('Klik om te kopiëren')" class="input" :value="organization.registerUrl" readonly @click="copyElement"><p class="info-box">
                {{ $t('c78c4a14-8796-4ddc-a449-33a38ef3a6ac') }}
            </p>

            <hr><h2>{{ $t('Handige links') }}</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('')" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    {{ $t('Documentatie') }}
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('tag/ledenadministratie-instellen')" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    {{ $t('Ledenadministratie instellen') }}
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, LoadingButton, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Tooltip, TooltipDirective } from '@stamhoofd/components';
import { OrganizationType } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        BackButton,
        LoadingButton,
        STList,
        STListItem,
    },
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class RegistrationPageSettingsView extends Mixins(NavigationMixin) {
    get organization() {
        return this.$organization;
    }

    get isYouth() {
        return this.organization.meta.type === OrganizationType.Youth;
    }

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy');

        event.target.contentEditable = false;

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: '📋 Gekopieerd!',
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle('overlay'));

        setTimeout(() => {
            (displayedComponent.componentInstance() as any)?.hide?.();
        }, 1000);
    }
}
</script>
