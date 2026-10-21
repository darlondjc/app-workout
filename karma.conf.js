// Configuração do Karma (testes no navegador). `npm test` abre o Chrome e acompanha as mudanças;
// `npm run test:ci` roda uma vez, sem janela, e é o que a CI usa.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    client: {
      // Mantém o resultado dos testes na tela do navegador depois de rodar.
      clearContext: false,
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    customLaunchers: {
      // Nas máquinas da CI o Chrome não abre sem desligar o sandbox.
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu'],
      },
    },
    restartOnFileChange: true,
  });
};
