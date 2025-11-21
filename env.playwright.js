module.exports = {
    presets: [
        // Run local DNS server
        "services/coredns", 

        // Start caddy server
        "services/caddy", 

        // Start stripe webhook server
        // "services/stripe", 

        // Connect with maildev smtp server
        // "services/maildev", 

        // Check frontend types
        // "services/frontend-type-checking", 

        // Default Stamhoofd configuration
        "stamhoofd",
        
        'playwright',
    ],
}
