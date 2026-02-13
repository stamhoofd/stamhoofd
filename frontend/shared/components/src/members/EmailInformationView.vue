<template>
    <LoadingViewTransition>
        <div class="st-view">
            <STNavigationBar :title="title" />

            <main>
                <h1>
                    {{ title }}
                </h1>

                <STList class="info">
                    <STListItem>
                        <h3 class="style-definition-label">
                            {{ $t('E-mailadres') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            <span>{{ emailInformation.email }}</span>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.markedAsSpam" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('Als spam gemarkeerd') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('De ontvanger heeft eerder een e-mail als spam gemarkeerd. Hierdoor worden geen e-mails meer verzonden naar dit e-mailadres. <button>Meer info</button>')">
                                <template #button="{content}">
                                    <a class="inline-link" :href="LocalizedDomains.getDocs('spam-complaints')" target="_blank">
                                        {{ content }}
                                    </a>
                                </template>
                            </I18nComponent>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.hardBounce" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('Hard bounce') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('Een e-mail kon eerder niet worden verzonden omwille van een permanenten reden (= hard bounce). Hierdoor worden geen e-mails meer verzonden naar dit e-mailadres. <button>Meer info</button>')">
                                <template #button="{content}">
                                    <a class="inline-link" :href="LocalizedDomains.getDocs('bounces')" target="_blank">
                                        {{ content }}
                                    </a>
                                </template>
                            </I18nComponent>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.hardBounce" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('Soft bounce') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('Een e-mail kon eerder niet worden verzonden omwille van een tijdelijke reden (= soft bounce). <button>Meer info</button>')">
                                <template #button="{content}">
                                    <a class="inline-link" :href="LocalizedDomains.getDocs('bounces')" target="_blank">
                                        {{ content }}
                                    </a>
                                </template>
                            </I18nComponent>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.unsubscribedAll" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('Afgemeld voor alle e-mails') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('De ontvanger heeft zich afgemeld voor alle e-mails.') }}
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.unsubscribedMarketing" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('Afgemeld voor marketing e-mails') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('De ontvanger heeft zich afgemeld voor marketing e-mails.') }}
                        </p>
                    </STListItem>
                </STList>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { I18nComponent, LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { EmailInformation } from '@stamhoofd/structures';
import { LoadingViewTransition } from '../containers';

const props = defineProps<{
    emailInformation: EmailInformation;
}>();

const title = $t('E-mailadres beheren');
</script>
