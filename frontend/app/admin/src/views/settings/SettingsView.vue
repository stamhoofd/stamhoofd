<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen" />

        <main class="center">
            <h1>
                Instellingen
            </h1>

            <BillingWarningBox />

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="$navigate('beheerders')">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/admin.svg"></template>
                    <h2 class="style-title-list">
                        Beheerders
                    </h2>
                    <p class="style-description">
                        Stel in wie toegang heeft tot het administratieportaal
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { ComponentOptions } from 'vue';
import AdminsView from './admins/AdminsView.vue';

defineRoutes([
    {
        url: 'beheerders',
        component: AdminsView as ComponentOptions,
    }
])
const $navigate = useNavigate()
</script>