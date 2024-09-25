

export default {
    rules: {
        "no-console": "off",
        "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
        "sort-imports": "off",
        "keyword-spacing": "warn",
        "eqeqeq": ["warn", "always"]
    }
}
