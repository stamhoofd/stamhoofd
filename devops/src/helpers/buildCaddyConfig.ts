import { Server } from "../classes/Server";

export function buildCaddyConfig(server: Server): string {
    const domains = server.config.domains;

    const cacheControlSubRoute = {
        "handler": "subroute",
        "routes": [
            {
                "match": [
                    {
                        "not": [
                            {
                                "path": [
                                    "*.js",
                                    "*.css",
                                    "*.png",
                                    "*.svg",
                                    "*.ttf",
                                    "*.woff",
                                    "*.woff2"
                                ]
                            }
                        ]
                    }
                ],
                "handle": [
                    {
                        "handler": "headers",
                        "response": {
                            "set": {
                                "Cache-Control": [
                                    "no-cache"
                                ]
                            }
                        }
                    }
                ],
                "terminal": false
            },
            {
                "match": [
                    {
                        "path": [
                            "*.js",
                            "*.css",
                            "*.png",
                            "*.svg",
                            "*.ttf",
                            "*.woff",
                            "*.woff2"
                        ]
                    }
                ],
                "handle": [
                    {
                        "handler": "headers",
                        "response": {
                            "set": {
                                "Cache-Control": [
                                    "max-age=2592000"
                                ]
                            }
                        }
                    }
                ],
                "terminal": false
            }
        ]
    };

    const registrationRoutes = [
        cacheControlSubRoute,
        {
            "handler": "file_server",
            "root": "/var/www/stamhoofd/registration/",
            "pass_thru": true
        },
        {
            "handler": "rewrite",
            "uri": "/index.html"
        },
        {
            "handler": "file_server",
            "root": "/var/www/stamhoofd/registration/"
        }
    ];

    const webshopRoutes = [
        cacheControlSubRoute,
        {
            "handler": "file_server",
            "root": "/var/www/stamhoofd/webshop/",
            "pass_thru": true
        },
        {
            "handler": "rewrite",
            "uri": "/index.html"
        },
        {
            "handler": "file_server",
            "root": "/var/www/stamhoofd/webshop/"
        }
    ];

    const routes: any[] = [];
    const tlsPolicies: any[] = [];

    if (server.config.backend) {
        routes.push({
            "match": [
                {
                    "host": [
                        server.config.domains.api,
                        "*."+server.config.domains.api
                    ]
                }
            ],
            "handle": [
                {
                    "handler": "reverse_proxy",
                    "upstreams": [
                        {
                            "dial": "127.0.0.1:9091"
                        }
                    ],
                    "headers": {
                        "request": {
                            "set": {
                                "x-real-ip": [
                                    "{http.request.remote}"
                                ]
                            }
                        }
                    }
                }
            ]
        });

        tlsPolicies.push({
            "subjects": [
                server.config.domains.api,
                "*."+server.config.domains.api
            ],
            "on_demand": false,
            "issuer": {
                "module": "acme",
                "challenges": {
                    "dns": {
                        "provider": {
                            "name": "lego_deprecated",
                            "provider_name": "digitalocean"
                        }
                    }
                }
            }
        });
    }

    if (server.config.frontend?.apps.includes("dashboard")) {
        tlsPolicies.push({
            "subjects": [
                "www."+domains.dashboard,
                domains.dashboard
            ],
            "on_demand": false,
            "issuer": {
                "module": "acme",
                "challenges": {
                    "dns": {
                        "provider": {
                            "name": "lego_deprecated",
                            "provider_name": "digitalocean"
                        }
                    }
                }
            }
        });

        routes.push({
            "match": [
                {
                    "host": [
                        domains.dashboard
                    ]
                }
            ],
            "handle": [
                cacheControlSubRoute,
                {
                    "handler": "file_server",
                    "root": "/var/www/stamhoofd/dashboard/",
                    "pass_thru": true
                },
                {
                    "handler": "rewrite",
                    "uri": "/index.html"
                },
                {
                    "handler": "file_server",
                    "root": "/var/www/stamhoofd/dashboard/"
                }
            ]
        },

        // Redirect www. to non www for dashboard
        {
            "match": [
                {
                    "host": [
                        `www.${domains.dashboard}`
                    ]
                }
            ],
            "handle": [
                {
                    "handler": "static_response",
                    "status_code": "302",
                    "headers": {
                        "Location": [
                            `https://${domains.dashboard}{http.request.uri}`
                        ]
                    }
                }
            ]
        })
    }

    if (server.config.frontend?.apps.includes("registration")) {
        tlsPolicies.push(
            {
                "subjects": [
                    "*."+domains.registration
                ],
                "on_demand": false,
                "issuer": {
                    "module": "acme",
                    "challenges": {
                        "dns": {
                            "provider": {
                                "name": "lego_deprecated",
                                "provider_name": "digitalocean"
                            }
                        }
                    }
                }
            }
        );
        routes.push(
            {
                "match": [
                    {
                        "host": [
                            "*."+domains.registration
                        ]
                    }
                ],
                "handle": registrationRoutes
            },
            {
                "match": [
                    {
                        "host": [
                            "inschrijven.*"
                        ]
                    }
                ],
                "handle": registrationRoutes
            }
        );
    }

    if (server.config.frontend?.apps.includes("webshop")) {
         tlsPolicies.push(
            {
                "subjects": [
                    "*."+domains.webshop
                ],
                "on_demand": false,
                "issuer": {
                    "module": "acme",
                    "challenges": {
                        "dns": {
                            "provider": {
                                "name": "lego_deprecated",
                                "provider_name": "digitalocean"
                            }
                        }
                    }
                }
            }
        );
        routes.push(
            {
                "match": [
                    {
                        "host": [
                            "*."+domains.webshop
                        ]
                    }
                ],
                "handle": webshopRoutes
            },
            {
                // default handler a.t.m.
                "handle": webshopRoutes
            }
        );
    }

    if (server.config.frontend?.apps.includes("webshop") || server.config.frontend?.apps.includes("registration")) {
        tlsPolicies.push({
            "on_demand": true
        });
    }

    const tlsAutomation = {
        "policies": tlsPolicies,
            "on_demand": {
                "rate_limit": {
                    "interval": "1d",
                    "burst": 50
                },
                "ask": "https://"+server.config.domains.api+"/v15/organization-from-domain"
            }
        };

    const config = {
        "apps": {
            "http": {
                "servers": {
                    "stamhoofd.app": {
                        "listen": [
                            ":443"
                        ],
                        "routes": routes
                    }
                }
            },
            "tls": {
                "automation": tlsAutomation
            }
        },
        "logging": {
            "sink": {
                "writer": {
                    "output": "file",
                    "filename": "/var/log/caddy/caddy-sink.log",
                    "roll_size_mb": 50
                }
            },
            "logs": {
                "default": {
                    "writer": {
                        "output": "file",
                        "filename": "/var/log/caddy/caddy.log",
                        "roll_size_mb": 50
                    }
                }
            }
        }
    };

    return JSON.stringify(config, undefined, 4);
}

