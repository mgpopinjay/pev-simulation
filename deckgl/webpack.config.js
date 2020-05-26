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
	}
};
