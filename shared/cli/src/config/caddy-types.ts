type CaddyHeaderOps = {
    add?: Record<string, string[]>;
    set?: Record<string, string[]>;
    delete?: string[];
    replace?: Record<string, { search?: string; search_regexp?: string; replace: string }[]>;
};

type CaddyMatcher = {
    host?: string[];
    header?: Record<string, string[]>;
    header_regexp?: unknown;
    path?: string[];
    not?: CaddyMatcher[];
};

export type CaddyHandler
    = | {
        handler: 'reverse_proxy';
        upstreams: Array<{ dial: string }>;
        stream_close_delay?: string;
        headers?: {
            request?: CaddyHeaderOps;
            response?: CaddyHeaderOps;
        };
    }
    | {
        handler: 'headers';
        request?: CaddyHeaderOps;
        response?: CaddyHeaderOps & { require?: { headers?: Record<string, string[]> } };
    }
    | {
        handler: 'replace_response';
        replacements: Array<{ search?: string; search_regexp?: string; replace: string }>;
    }
    | {
        handler: 'subroute';
        routes: Array<{ match?: CaddyMatcher[]; handle: CaddyHandler[]; terminal?: boolean }>;
    };

export type CaddyRoute = {
    group?: string;
    match: CaddyMatcher[];
    handle: CaddyHandler[];
    terminal?: boolean;
};
