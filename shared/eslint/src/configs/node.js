
import nodePlugin from 'eslint-plugin-n'

export default [
    {
        plugins: {
            n: nodePlugin
        },
        rules: {
            "n/file-extension-in-import": [
                "error", 
                "always"
            ]
        }
    }
]
