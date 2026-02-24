import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AuditLogReplacement, AuditLogReplacementType, LimitedFilteredRequest } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { h, withDirectives } from 'vue';
import { PromiseView } from '../../containers';
import { useAppContext } from '../../context';
import CopyableDirective from '../../directives/Copyable';
import TooltipDirective from '../../directives/Tooltip';
import { EventOverview } from '../../events';
import { useEventsObjectFetcher, useMembersObjectFetcher, useOrganizationsObjectFetcher, usePaymentsObjectFetcher } from '../../fetchers';
import { useShowMember } from '../../members';
import { Toast } from '../../overlays/Toast';
import { PaymentView } from '../../payments';
import SafeHtmlView from '../SafeHtmlView.vue';

export interface Renderable {
    render(context: Context): string | ReturnType<typeof h> | (ReturnType<typeof h> | string)[];
}

function isRenderable(obj: unknown): obj is Renderable {
    return typeof obj === 'object' && obj !== null && (obj as Renderable).render !== undefined;
}

function copyable(vnode: ReturnType<typeof h>, text?: string): ReturnType<typeof h> {
    return withDirectives(vnode, [[CopyableDirective, text]]);
}

function tooltip(vnode: ReturnType<typeof h>, text: string): ReturnType<typeof h> {
    return withDirectives(vnode, [[TooltipDirective, text]]);
}

export function renderAny(obj: unknown, context: Context): () => (string | ReturnType<typeof h> | (ReturnType<typeof h> | string)[]) {
    if (typeof obj === 'string') {
        return () => obj;
    }

    if (isRenderable(obj)) {
        return () => obj.render(context);
    }

    if (obj instanceof AuditLogReplacement) {
        if (obj.type === AuditLogReplacementType.Member && obj.id) {
            // Open member button
            const showMember = useShowMember();
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showMember(obj.id!),
                type: 'button',
            }, obj.value);
        }

        if (obj.type === AuditLogReplacementType.Payment && obj.id) {
            // Open payment button
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showPayment(obj.id!, context),
                type: 'button',
            }, obj.value);
        }

        if (obj.type === AuditLogReplacementType.StripeAccount) {
            // Render as code
            return () => copyable(h('span', { class: 'style-inline-code style-copyable' }, obj.value));
        }

        if (obj.type === AuditLogReplacementType.Event && obj.id) {
            // Open member button
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showEvent(obj.id!, context),
                type: 'button',
            }, obj.value);
        }

        if (obj.type === AuditLogReplacementType.Image && obj.id) {
            // Open member button
            return () => h('a', {
                class: 'style-inline-resource simple',
                href: obj.id,
                target: '_blank',
            }, [
                h('img', {
                    src: obj.id,
                    style: {
                        'width': '21px',
                        'height': '21px',
                        'object-fit': 'scale-down',
                        'border-radius': '3px',
                        'display': 'inline-block',
                        'margin-right': '4px',
                        'vertical-align': 'text-bottom',
                        'overflow': 'hidden',
                    },
                }),
                obj.value || $t(`f0726317-6979-41b6-bd57-7f6eb3422dc6`),
            ]);
        }

        if (obj.type === AuditLogReplacementType.File && obj.id) {
            // Open member button
            return () => h('a', {
                class: 'style-inline-resource simple',
                href: obj.id,
                target: '_blank',
            }, [
                obj.value || $t(`108e2ee2-0c29-4f5e-9c34-b9030dd369b9`),
            ]);
        }

        if (obj.type === AuditLogReplacementType.Organization && obj.id) {
            if (context.app === 'admin') {
            // Open member button
                return () => h('button', {
                    class: 'style-inline-resource button simple',
                    onClick: () => showOrganization(obj.id!, context),
                    type: 'button',
                }, obj.value);
            }
        }

        if (obj.type === AuditLogReplacementType.Html && obj.value) {
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showHtml(obj.value!, context),
                type: 'button',
            }, obj.toString() as string);
        }

        if (obj.type === AuditLogReplacementType.LongText && obj.value) {
            if (obj.value.length < 200 && !obj.value.includes('\n')) {
                return () => obj.value;
            }
            const style = `padding: 0; margin: 0; font-size: 15px; line-height: 1.5; font-family: "Metropolis", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";`;
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showHtml('<p style="' + Formatter.escapeHtml(style) + '">' + Formatter.escapeHtml(obj.value!).replace(/\n/g, '<br>') + '</p>', context),
                type: 'button',
            }, obj.toString() as string);
        }

        if (obj.type === AuditLogReplacementType.Array) {
            const allRenderMethods = obj.values.map(part => renderAny(part, context));

            return () => {
                const a = allRenderMethods.flatMap((p) => {
                    const q = p();
                    if (Array.isArray(q)) {
                        if (q.length === 0) {
                            return [];
                        }
                        return [...q, ' → '];
                    }
                    return [q, ' → '];
                });
                a.pop();
                return a;
            };
        }

        if (obj.description) {
            return () => tooltip(h('span', { class: 'style-inline-resource style-tooltip' }, obj.toString()), obj.description);
        }

        if (obj.id) {
            return () => copyable(tooltip(h('span', { class: 'style-inline-resource style-tooltip' }, obj.toString() || $t('0e21480d-5597-4337-bcee-5f4eba73fb7e')), 'ID: ' + obj.id), obj.id);
        }
        const str = obj.toString();

        if (str.startsWith('#') && str.length === 7) {
            // Render color string
            return () => [
                h('span', {
                    class: 'style-color-box',
                    style: {
                        backgroundColor: str,
                    },
                }),
                ' ' + str,
            ];
        }

        if (!str) {
            return () => [];
        }

        return () => str;
    }
    return () => '';
}

export const RenderTextComponent = {
    props: {
        text: {
            type: Array,
            required: true,
        },
    },
    setup(props: { text: unknown[] }) {
        const present = usePresent();
        const memberFetcher = useMembersObjectFetcher();
        const eventFetcher = useEventsObjectFetcher();
        const organizationFetcher = useOrganizationsObjectFetcher();
        const paymentFetcher = usePaymentsObjectFetcher();
        const app = useAppContext();

        const context: Context = {
            app,
            present,
            memberFetcher,
            eventFetcher,
            organizationFetcher,
            paymentFetcher,
        };

        const renderFunctions = props.text.map(part => renderAny(part, context));
        return () => renderFunctions.map(r => r());
    },
};

export type Context = {
    app: ReturnType<typeof useAppContext>;
    present: ReturnType<typeof usePresent>;
    memberFetcher: ReturnType<typeof useMembersObjectFetcher>;
    eventFetcher: ReturnType<typeof useEventsObjectFetcher>;
    organizationFetcher: ReturnType<typeof useOrganizationsObjectFetcher>;
    paymentFetcher: ReturnType<typeof usePaymentsObjectFetcher>;
};

async function showHtml(html: string, context: Context) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(SafeHtmlView, {
            html,
            title: $t(`71a1a391-f437-41e4-b2d4-e9e32121d4ee`),
        }),
    });

    await context.present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

async function showPayment(paymentId: string, context: Context) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                const payments = await context.paymentFetcher.fetch(new LimitedFilteredRequest({
                    filter: {
                        id: paymentId,
                    },
                    limit: 1,
                }));
                if (payments.results.length === 0) {
                    Toast.error($t(`5e6f043a-6ed5-41eb-b670-d9ac6b63e598`)).show();
                    throw new Error('Payment not found');
                }
                return new ComponentWithProperties(PaymentView, {
                    payment: payments.results[0],
                });
            },
        }),
    });

    await context.present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

async function showEvent(eventId: string, context: Context) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                const events = await context.eventFetcher.fetch(new LimitedFilteredRequest({
                    filter: {
                        id: eventId,
                    },
                    limit: 1,
                }));
                if (events.results.length === 0) {
                    Toast.error($t(`6f8446d7-f625-4134-bf05-553ba577619f`)).show();
                    throw new Error('Event not found');
                }
                return new ComponentWithProperties(EventOverview, {
                    event: events.results[0],
                });
            },
        }),
    });

    await context.present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

async function showOrganization(organizationId: string, context: Context) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                const organizations = await context.organizationFetcher.fetch(new LimitedFilteredRequest({
                    filter: {
                        id: organizationId,
                    },
                    limit: 1,
                }));
                if (organizations.results.length === 0) {
                    Toast.error($t(`6350b2c6-ab40-4a92-873e-f667386055a4`)).show();
                    throw new Error('Event not found');
                }
                const OrganizationView = (await import('@stamhoofd/admin-frontend/src/views/organizations/OrganizationView.vue')).default;
                return new ComponentWithProperties(OrganizationView, {
                    organization: organizations.results[0],
                    getNext: () => null,
                    getPrevious: () => null,
                });
            },
        }),
    });

    await context.present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}
