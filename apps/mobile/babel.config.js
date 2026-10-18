module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Las migraciones de Drizzle importan archivos .sql como texto.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
