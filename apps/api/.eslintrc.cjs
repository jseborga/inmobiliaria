module.exports = {
  root: true,
  ...require('@inmobiliaria/config/eslint.base.cjs'),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
};
