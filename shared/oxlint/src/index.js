'use strict';

// Configs
import frontend from './configs/frontend.js';
import node from './configs/node.js';
import baseRules from './configs/default.js';

function merge(...a) {
    if (a.length === 0) {
        return {
            plugins: [],
            rules: {},
        }
    }
    if (a.length === 1) {
        return a;
    }
    if (a.length === 2) {
        return mergeTwo(a[0], a[1]);
    }
    return merge(mergeTwo(a[0], a[1]), ...a.slice(2));
}

function mergeTwo(a, b) {
    return {
        plugins: [...new Set([...a.plugins, ...b.plugins]).values()],
        rules: {
            ...a.rules,
            ...b.rules
        },
        overrides: [
            ...(a.overrides ?? []),
            ...(b.overrides ?? [])
        ]
    }
}

export default {
    configs: {
        base: baseRules,
        frontend: merge(
            baseRules,
            frontend
        ),
        backend: merge(
            baseRules,
            node
        ),
        shared: merge(
            baseRules,
            node
        )
    },
};
