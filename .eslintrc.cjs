module.exports = {
    overrides: [
        {
            files: ['*.js']
        }
    ],

    extends: [
        'eslint:recommended',

        // https://www.npmjs.com/package/eslint-config-airbnb-base
        'airbnb-base',

        // https://github.com/import-js/eslint-plugin-import
        'plugin:import/recommended'
    ],

    env: {
        es2022: true,
        node: true
    },

    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },

    rules: {
        // base
        'arrow-parens': ['warn', 'as-needed'],
        'comma-dangle': ['error', 'never'],
        'no-console': 'off',
        'no-multiple-empty-lines': ['error', {max: 2, maxEOF: 0, maxBOF: 0}],
        'no-plusplus': 'off',
        'no-shadow': ['error', {builtinGlobals: false, hoist: 'all', allow: ['error']}],
        'no-unused-expressions': ['error', {allowShortCircuit: true}],
        'no-use-before-define': 'off',
        'object-curly-spacing': ['error', 'never'],
        'space-before-function-paren': ['error', {anonymous: 'always', named: 'always'}],
        'space-in-parens': 'off',
        'spaced-comment': 'off',
        'class-methods-use-this': 'off',
        indent: ['error', 4, {SwitchCase: 1}],
        'default-case': 'off',
        'max-len': ['warn', {code: 150}],
        'no-multi-assign': 'off',
        'no-return-assign': ['error', 'except-parens'],
        'import/no-cycle': 'off',
        'no-restricted-exports': 'off',
        'no-restricted-syntax': 'off',
        'no-unused-vars': 'error',
        'object-curly-newline': [
            'error',
            {
                ObjectExpression: {
                    minProperties: 6,
                    multiline: true,
                    consistent: true
                },
                ObjectPattern: {
                    minProperties: 6,
                    multiline: true,
                    consistent: true
                },
                ImportDeclaration: {
                    minProperties: 6,
                    multiline: true,
                    consistent: true
                },
                ExportDeclaration: {
                    minProperties: 6,
                    multiline: true,
                    consistent: true
                }
            }
        ],

        quotes: [
            'error',
            'single',
            {
                allowTemplateLiterals: true
            }
        ],

        'jsx-quotes': ['error', 'prefer-double'],

        // plugins
        'import/extensions': ['warn', 'ignorePackages'],
        'import/no-extraneous-dependencies': 'off',
        'import/prefer-default-export': 'off',
        'import/no-anonymous-default-export': 'off',
        'import/no-relative-packages': 'off',
        'import/no-named-as-default-member': 'off',
        'import/order': 'off',

        'no-param-reassign': 'off',
        'guard-for-in': 'off',
        'no-await-in-loop': 'off',
        'no-continue': 'off',
        'no-bitwise': 'off'
    }
};
