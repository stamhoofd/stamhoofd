import posthog from 'posthog-js'
let initialized = false

export function usePostHog() {
    try {
        if (initialized) {
            return
        }
        if (STAMHOOFD.environment !== 'development') {
            // Don't initialize outside dev mode
            return
        }
      
        posthog.init('phc_bZDDXyHcQ9BINAgLRDoWlLlqdDPro2lq9MDWz2qL5pW', {
            api_host: 'https://eu.i.posthog.com',
            defaults: '2025-05-24',
            person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
        })
        initialized = true
    } catch (error) {
        console.error('Failed to initialize PostHog', error)
    }
}