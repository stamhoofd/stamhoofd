import { Formatter } from '@stamhoofd/utility';
import { type ConcurrentlyCommandInput } from 'concurrently';
import fs from 'fs/promises';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCallback);

export async function init(config: SharedEnvironment): Promise<ConcurrentlyCommandInput[]> {
    const caddyConfig = buildCaddyConfig(config.domains);
    const tmpFileLocation = __dirname + '/caddy.json';

    // Write to file
    await fs.writeFile(tmpFileLocation, JSON.stringify(caddyConfig, null, 2));

    // Make sure to kill any running caddy processes
    try {
        const cmd = 'brew services stop caddy';
        await exec(cmd);
    }
    catch (error) {
        // ignore
    }

    // Make sure to kill any running caddy processes
    try {
        const cmd = 'caddy stop';
        await exec(cmd);
    }
    catch (error) {
        // ignore
    }

    return [
        {
            name: 'caddy',
            command: 'caddy run -w --config \'' + tmpFileLocation + '\'',
            prefixColor: 'red',
        },
    ];
}

function buildCaddyConfig(domains: StamhoofdDomains) {
    const routes: any[] = [
        {
            match: [
                {
                    host: [
                        domains.rendererApi,
                    ],
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    upstreams: [
                        {
                            dial: '127.0.0.1:9093',
                        },
                    ],
                    headers: {
                        request: {
                            set: {
                                'x-real-ip': [
                                    '{http.request.remote}',
                                ],
                            },
                        },
                    },
                },
            ],
        },
        {
            match: [
                {
                    host: [
                        domains.api,
                        '*.' + domains.api,
                    ],
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    upstreams: [
                        {
                            dial: '127.0.0.1:9091',
                        },
                    ],
                    headers: {
                        request: {
                            set: {
                                'x-real-ip': [
                                    '{http.request.remote}',
                                ],
                            },
                        },
                    },
                },
            ],
        },
        {
            match: [
                {
                    host: [
                        domains.dashboard,
                    ],
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    load_balancing: {
                        retries: 5,
                    },
                    upstreams: [
                        {
                            dial: '127.0.0.1:8080',
                        },
                    ],
                },
            ],
        },
    ];

    if (domains.webshop) {
        routes.push({
            match: [
                {
                    host: Formatter.uniqueArray([...Object.values(domains.webshop)]),
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    load_balancing: {
                        retries: 5,
                    },
                    upstreams: [
                        {
                            dial: '127.0.0.1:8082',
                        },
                    ],
                },
            ],
        });
    }

    if (domains.registration) {
        routes.push({
            match: [
                {
                    host: Formatter.uniqueArray([...Object.values(domains.registration)].map(domain => ('*.' + domain))),
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    load_balancing: {
                        retries: 5,
                    },
                    upstreams: [
                        {
                            dial: '127.0.0.1:8081',
                        },
                    ],
                },
            ],
        });
    }

    routes.push(
        {
            match: [
                {
                    vars_regexp: {
                        '{http.request.host}': {
                            pattern: '^inschrijven\\.',
                        },
                    },
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    load_balancing: {
                        retries: 5,
                    },
                    upstreams: [
                        {
                            dial: '127.0.0.1:8081',
                        },
                    ],
                },
            ],
        },
        {
            handle: [
                {
                    handler: 'reverse_proxy',
                    load_balancing: {
                        retries: 5,
                    },
                    upstreams: [
                        {
                            dial: '127.0.0.1:8082',
                        },
                    ],
                },
            ],
        },
    );

    return {
        apps: {
            http: {
                servers: {
                    stamhoofd: {
                        listen: [
                            ':443',
                            ':80',
                        ],
                        routes,
                    },
                },
            },
            tls: {
                automation: {
                    policies: [
                        {
                            subjects: Formatter.uniqueArray([
                                domains.dashboard,
                                domains.api,
                                '*.' + domains.api,
                                ...(domains.registration ? [...Object.values(domains.registration)].map(domain => ('*.' + domain)) : []),
                                ...(domains.webshop ? [...Object.values(domains.webshop)] : []),
                                domains.rendererApi,
                            ]),
                            on_demand: false,
                            issuers: [
                                {
                                    module: 'internal',
                                },
                            ],
                        },
                        {
                            on_demand: true,
                            issuers: [{
                                module: 'internal',
                            }],
                        },
                    ],
                    on_demand: {
                        rate_limit: {
                            interval: '1d',
                            burst: 200,
                        },
                    },
                },
            },
        },
    };
}
