import { projectExceptionEvent } from '@common/errors';
import type { ExceptionArtifacts, ExceptionDeployment } from '@common/errors';
import { globalHandlersIntegration, init, vueIntegration } from '@sentry/vue';
import type { App } from 'vue';

export function configureVueExceptions(app: App, config: ExceptionDeployment, lookup: ExceptionArtifacts) {
    if (!config.dsn || window.top !== window || window.origin === 'null'
        || window.origin !== config.browserOrigin || location.origin !== config.browserOrigin) return;
    return init({
        app,
        dsn: config.dsn,
        release: config.release,
        environment: config.environment,
        defaultIntegrations: false,
        integrations: [vueIntegration({ attachProps: false }), globalHandlersIntegration()],
        sendClientReports: false,
        transportOptions: { fetchOptions: { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' } },
        beforeSend(event, hint) {
            const mechanism = hint.mechanism?.type;
            const boundary = mechanism === 'auto.function.vue.error_handler' ? 'browser.vue' : 'browser.global';
            return projectExceptionEvent(event, hint.originalException, boundary, config, lookup);
        },
    });
}
