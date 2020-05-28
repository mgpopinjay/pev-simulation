const path = require('path');

module.exports = {
	mode: 'development',
	entry: './src/app.js',
	devtool: 'inliine-source-map',
	devServer: {
		contentBase: './dist',
	},
	output: {
		filename: 'main.js',
		path: path.resolve(__dirname, 'dist'),
	},
  resolve: {
    alias: {
      'mapbox-gl$': path.resolve('./node_modules/mapbox-gl/dist/mapbox-gl.js')
    }
	}
};
