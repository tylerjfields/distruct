var Dist = require('./distruct.js'),
path = require('path');

var config = require('./config.json');

config.directories = {
    source: path.resolve(__dirname, 'src'),
    builds: path.resolve(__dirname, 'builds')
};

Dist.config(config);

//Build & Deploy
Dist.build(Dist.deploy);

// Start express server.
Dist.serve();