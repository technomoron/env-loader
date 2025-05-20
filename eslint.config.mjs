import vueTsEslintConfig from '@vue/eslint-config-typescript';
import importPlugin from 'eslint-plugin-import'; // Add this
import pluginVue from 'eslint-plugin-vue';

export default [
    {
        name: 'app/files-to-lint',
        files: ['**/*.{ts,mts,tsx,vue}']
    },
    {
        name: 'app/files-to-ignore',
        ignores: [
            '**/dist/**',
            '**/coverage/**',
            'node_modules',
            '*.config.{js,ts}',
            'package-lock.json',
            'yarn.lock',
            '.vscode',
            '.nuxt',
            'public',
            '**/*.d.ts'
        ]
    },
    {
        plugins: {
            vue: pluginVue,
            import: importPlugin // Register the import plugin here
        }
    },
    ...vueTsEslintConfig(),
    {
        rules: {
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true }
                }
            ],
            'import/default': 'error',
            'import/export': 'error',
            'import/extensions': 'off',
            'import/first': 'error',
            'import/no-cycle': 'warn',
            'import/no-useless-path-segments': 'error',
            'import/no-self-import': 'error',
            'import/no-absolute-path': 'error',
            'import/no-named-as-default': 'error',
            'import/no-duplicates': 'error',
            'import/no-namespace': 'error',
            'import/no-deprecated': 'error',

            // Other rules...
        }
    }
];
