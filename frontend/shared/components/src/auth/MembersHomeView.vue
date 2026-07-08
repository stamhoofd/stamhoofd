<template>
    <div class="st-view members-home-view" data-testid="members-home-view">
        <STNavigationBar :title="$t('%1W0', { organization: organization.name })" />

        <main class="limit-width">
            <div class="white-top view">
                <main>
                    <div class="split-login-view">
                        <div class="container login-view">
                            <h1>{{ $t('%1cs', {organization: organization.name}) }}</h1>
                            <p>{{ $t('%1dy') }}</p>

                            <p v-if="isTrial" class="secundary-box icon trial">
                                {{ $t('%1aG') }}
                            </p>

                            <div class="button-box">
                                <button class="button primary full" type="button" data-testid="open-login-button" @click="openLogin()">
                                    <span class="icon lock" />
                                    <span>{{ $t('%Qg') }}</span>
                                </button>
                                <button class="button secundary full" data-testid="open-signup-button" type="button" @click="openSignup()">
                                    {{ $t('%ur') }}
                                </button>
                            </div>
                        </div>

                        <aside>
                            <h1>{{ $t('%1Yb') }}</h1>
                            <ol>
                                <li>{{ $t('%1dE') }}</li>
                                <li>{{ $t('%1Zp') }}</li>
                                <li v-if="hasOnlinePaymentMethod && hasTransfer">
                                    {{ $t('%1Z3') }}
                                </li>
                                <li v-else-if="hasOnlinePaymentMethod">
                                    {{ $t('%1VN') }}
                                </li>
                                <li v-else-if="hasTransfer">
                                    {{ $t('%1bA') }}
                                </li>
                                <li>{{ $t('%1ZG') }}</li>
                            </ol>
                        </aside>
                    </div>
                    <p class="stamhoofd-footer">
                        <a :href="'https://' + LocalizedDomains.marketing + '/ledenadministratie?utm_medium=ledenportaal'" target="_blank" class="button text"><span>Ledenadministratie via</span> <strong class="notranslate">Stamhoofd</strong></a>
                    </p>
                </main>
            </div>

            <div class="view gray-shadow">
                <main>
                    <GroupTreeVue :category="organization.period.publicCategoryTree" />
                </main>
            </div>

            <LegalFooter :organization="organization" class="shade" />
        </main>
    </div>
</template>

<script setup lang="ts">
import GroupTreeVue from './components/GroupTree.vue';
import { defineRoutes, UrlHelper, useNavigate } from '@simonbackx/vue-app-navigation';

import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import LegalFooter from '@stamhoofd/components/navigation/LegalFooter.vue';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { PaymentMethod, PaymentMethodHelper } from '@stamhoofd/structures';
import { computed } from 'vue';

enum Routes {
    Login = 'login',
    Signup = 'signup',
}

defineRoutes([
    {
        name: Routes.Login,
        url: 'login',
        component: async () => (await import('#auth/LoginView.vue')).default,
        present: 'sheet',
        paramsToProps() {
            return {
                initialEmail: UrlHelper.shared.getSearchParams().get('email') ?? '',
            };
        },
    },
    {
        name: Routes.Signup,
        url: 'account-aanmaken',
        component: async () => (await import('@stamhoofd/components/auth/SignupView.vue')).default as any,
        present: 'popup',
        paramsToProps() {
            return {
                initialEmail: UrlHelper.shared.getSearchParams().get('email') ?? '',
            };
        },
    },
]);

const $navigate = useNavigate();
const organization = useRequiredOrganization();
const hasOnlinePaymentMethod = organization.value.meta.registrationPaymentConfiguration.paymentMethods.find(p => PaymentMethodHelper.isOnline(p));
const hasTransfer = organization.value.meta.registrationPaymentConfiguration.paymentMethods.find(p => p === PaymentMethod.Transfer);
const customDomain = computed(() => {
    return window.location.hostname !== STAMHOOFD.domains.dashboard;
});

const isTrial = computed(() => organization.value.meta.packages.isMembersTrial);

async function openLogin() {
    await $navigate(Routes.Login);
}

async function openSignup() {
    await $navigate(Routes.Signup);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.members-home-view {
    .stamhoofd-footer {
        @extend %style-description;
        padding: 15px 0;
        padding-top: 30px;

        a {
            white-space: normal;
            text-overflow: initial;
            height: auto;
            line-height: 1.4;
        }

        strong {
            color: $color-primary;
            margin-left: 5px;
        }
    }

    .split-login-view {
        padding-top: 15px;
        display: grid;
        width: 100%;
        grid-template-columns: minmax(300px, 350px) auto;
        gap: 100px;
        align-items: center;

        @media (max-width: 800px) {
            padding-top: 0;
            display: block;

            > aside {
                padding: 0 var(--st-horizontal-padding, 20px);
                padding-top: 20px;
            }
        }

        ol {
            list-style: none;
            counter-reset: li;
            @extend %style-normal;
            padding-left: 30px;

            li {
                counter-increment: li;
                padding: 8px 0;
            }

            li::before {
                content: counter(li)".";
                @extend %style-normal;
                color: $color-primary;
                display: inline-block;
                width: 30px;
                margin-left: -30px;;
            }
        }

        aside > h1 {
            @extend %style-title-2;
            padding-bottom: 20px;;
        }
    }

    .login-view {
        > h1 {
            @extend %style-title-1;
            padding-bottom: 20px;
        }

        > h1 + p {
            @extend %style-description;
        }

        > .button-box {
            padding-top: 20px;
            display: flex;
            flex-direction: column;
            justify-content: stretch;
            gap: 5px;
        }
    }
}
</style>
