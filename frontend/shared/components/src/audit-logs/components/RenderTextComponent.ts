import type { usePresent } from '@simonbackx/vue-app-navigation';
import { AuditLogReplacement, AuditLogReplacementType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { h, withDirectives } from 'vue';
import type { useAppContext } from '../../context';
import CopyableDirective from '../../directives/Copyable';
import TooltipDirective from '../../directives/Tooltip';
import { useShowEvent } from '../../events';
import type { useEventsObjectFetcher, useMembersObjectFetcher, useOrganizationsObjectFetcher, usePaymentsObjectFetcher } from '../../fetchers';
import { useShowMember } from '../../members';
import { useShowPayment } from '../../payments';
import { useShowHtml } from '../hooks';

export type RenderResult = string | ReturnType<typeof h> | (ReturnType<typeof h> | string)[];

/**
 * A custom renderer for a specific AuditLogReplacementType. It is called while rendering (inside a
 * component setup context, so it may use composables/hooks). Return a render function to take over
 * rendering for this replacement, or undefined to fall back to the default rendering.
 */
export type AuditLogCustomRenderer = (obj: AuditLogReplacement) => (() => RenderResult) | undefined;

/**
 * Maps an AuditLogReplacementType to a custom renderer. This is the dependency-injection point that
 * lets individual apps (e.g. the admin app) plug in renderers that depend on app-specific code,
 * without the shared components package depending on those apps.
 */
export type AuditLogCustomRenderers = Partial<Record<AuditLogReplacementType, AuditLogCustomRenderer>>;

export interface Renderable {
    setup(): () => (string | ReturnType<typeof h> | (ReturnType<typeof h> | string)[]);
}

function isRenderable(obj: unknown): obj is Renderable {
    return typeof obj === 'object' && obj !== null && (obj as Renderable).setup !== undefined;
}

function copyable(vnode: ReturnType<typeof h>, text?: string): ReturnType<typeof h> {
    return withDirectives(vnode, [[CopyableDirective, text]]);
}

function tooltip(vnode: ReturnType<typeof h>, text: string): ReturnType<typeof h> {
    return withDirectives(vnode, [[TooltipDirective, text]]);
}

export function renderAny(obj: unknown, customRenderers?: AuditLogCustomRenderers): () => (string | ReturnType<typeof h> | (ReturnType<typeof h> | string)[]) {
    if (typeof obj === 'string') {
        return () => obj;
    }

    if (isRenderable(obj)) {
        return obj.setup();
    }

    if (obj instanceof AuditLogReplacement) {
        const customRenderer = obj.type ? customRenderers?.[obj.type] : undefined;
        if (customRenderer) {
            const result = customRenderer(obj);
            if (result !== undefined) {
                return result;
            }
        }

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
            const showPayment = useShowPayment();
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showPayment(obj.id!),
                type: 'button',
            }, obj.value);
        }

        if (obj.type === AuditLogReplacementType.StripeAccount) {
            // Render as code
            return () => copyable(h('span', { class: 'style-inline-code style-copyable' }, obj.value));
        }

        if (obj.type === AuditLogReplacementType.Event && obj.id) {
            // Open member button
            const showEvent = useShowEvent();
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showEvent(obj.id!),
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
                obj.value || $t(`%la`),
            ]);
        }

        if (obj.type === AuditLogReplacementType.File && obj.id) {
            // Open member button
            return () => h('a', {
                class: 'style-inline-resource simple',
                href: obj.id,
                target: '_blank',
            }, [
                obj.value || $t(`%yU`),
            ]);
        }

        if (obj.type === AuditLogReplacementType.Html && obj.value) {
            const showHtml = useShowHtml();
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showHtml(obj.value!),
                type: 'button',
            }, obj.toString() as string);
        }

        if (obj.type === AuditLogReplacementType.LongText && obj.value) {
            if (obj.value.length < 200 && !obj.value.includes('\n')) {
                return () => obj.value;
            }
            const style = `padding: 0; margin: 0; font-size: 15px; line-height: 1.5; font-family: "Metropolis", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";`;
            const showHtml = useShowHtml();
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showHtml('<p style="' + Formatter.escapeHtml(style) + '">' + Formatter.escapeHtml(obj.value!).replace(/\n/g, '<br>') + '</p>'),
                type: 'button',
            }, obj.toString() as string);
        }

        if (obj.type === AuditLogReplacementType.Array) {
            const allRenderMethods = obj.values.map(part => renderAny(part, customRenderers));

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
            return () => copyable(tooltip(h('span', { class: 'style-inline-resource style-tooltip' }, obj.toString() || $t('%15v')), 'ID: ' + obj.id), obj.id);
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
        customRenderers: {
            type: Object,
            required: false,
            default: undefined,
        },
    },
    setup(props: { text: unknown[]; customRenderers?: AuditLogCustomRenderers }) {
        const renderFunctions = props.text.map(part => renderAny(part, props.customRenderers));
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
