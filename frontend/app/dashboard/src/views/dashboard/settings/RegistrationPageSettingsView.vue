<template>
    <div id="registration-page-settings-view" class="st-view background">
        <STNavigationBar :title="$t(`Jullie ledenportaal`)"/>

        <main>
            <h1>{{ $t('e475b85a-9849-4182-b8bf-6e504bee1144') }}</h1>

            <p class="style-description">
                {{ $t('3e94193d-873b-4770-ba03-5f7528debf2c') }}
            </p>

            <hr><h2 class="style-with-button">
                <div>{{ $t('e475b85a-9849-4182-b8bf-6e504bee1144') }}</div>
                <div>
                    <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                        <span class="icon external"/>
                        <span class="hide-small">{{ $t('83e8ab51-f6b6-4ca5-8932-046a91adf1a8') }}</span>
                    </a>
                </div>
            </h2>

            <input v-tooltip="'Klik om te kopiëren'" class="input" :value="organization.registerUrl" readonly @click="copyElement"><p class="info-box">
                {{ $t('c78c4a14-8796-4ddc-a449-33a38ef3a6ac') }}
            </p>

            <hr><h2>{{ $t('25d6a07b-87d3-4f52-8a41-bd9293050ddf') }}</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('')" target="_blank">
                    <template #left>
                        <span class="icon link"/>
                    </template>
                    {{ $t('71dc78a3-fe6b-4eae-9ffb-b241f74487f1') }}
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('tag/ledenadministratie-instellen')" target="_blank">
                    <template #left>
                        <span class="icon link"/>
                    </template>
                    {{ $t('7dca10b8-915a-43ac-9f2c-6d28fb244747') }}
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
