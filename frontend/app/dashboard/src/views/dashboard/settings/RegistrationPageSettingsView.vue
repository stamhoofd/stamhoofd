<template>
    <div id="registration-page-settings-view" class="st-view background">
        <STNavigationBar :title="$t(`Jullie ledenportaal`)" />

        <main>
            <h1>{{ $t('6ce03229-0735-459d-aa3c-da665e4bafc2') }}</h1>

            <p class="style-description">
                {{ $t('3e94193d-873b-4770-ba03-5f7528debf2c') }}
            </p>

            <hr><h2 class="style-with-button">
                <div>{{ $t('6ce03229-0735-459d-aa3c-da665e4bafc2') }}</div>
                <div>
                    <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                        <span class="icon external" />
                        <span class="hide-small">{{ $t('9e85b407-6e12-4003-9847-5b7d277b87ff') }}</span>
                    </a>
                </div>
            </h2>

            <input :v-tooltip="$t('6b0bca07-3cba-45cf-bc94-e3217e59a69f')" class="input" :value="organization.registerUrl" readonly @click="copyElement"><p class="info-box">
                {{ $t('c78c4a14-8796-4ddc-a449-33a38ef3a6ac') }}
            </p>

            <hr><h2>{{ $t('0f2e6f48-02a5-47af-8148-2f37af5ba91a') }}</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('')" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    {{ $t('36399c64-c1e2-4427-b1ab-5fd8edbf0f4a') }}
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('tag/ledenadministratie-instellen')" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    {{ $t('9ce3b441-a826-4708-a0e9-ceb2c7a6136c') }}
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
