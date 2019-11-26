const 

    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    ejs = require('ejs'),
    child_process = require('child_process'),

    express = require('express'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    mime = require('mime-types'),
    strip = require('strip-comments'),
    JavaScriptObfuscator = require('javascript-obfuscator');
    
var config = {delimiter: "*"}, configFile = null;
 
const fn = {
    
    "directory": function(){
        var args = [];
        for (let each in arguments) args.push(arguments[each]); 
        return fs.readdirSync(args.join('/'));
    },
    
    "exists": function(path){
        var args = [];
        for (let each in arguments) args.push(arguments[each]); 
        return fs.existsSync(args.join('/'));
    },
    
    "read": function(){
        var args = [];
        for (let each in arguments) args.push(arguments[each]);
        return fs.readFileSync(args.join('/'));
    },
    
    "uncomment": function(text, options){ 
        return strip(text, (options||{keepProtected: true})); 
    }
    
};

// Compare wildcard urls for ignore rules.
function compare(str, rule) {
    var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
}
  
   
var Distruct = {

    "config": (configuration) => {

        var cfg = null; 
        
        if (typeof configuration == 'string') {

            if ( fs.existsSync(configuration) ) {
                try {
                    cfg = JSON.parse(fs.readFileSync(configuration).toString());
                    configFile = configuration;
                } catch (ParseError) {
                    console.error(`Could not parse config from file '${configuration}'`);
                }
            } else {
                console.error(`File '${configuration}' does not exist.`);
            }  

        } else if (typeof configuration == 'object') cfg = configuration;
 
        if (cfg) for (let each in cfg) {
            
            config[each] = cfg[each];

        }

        return configuration;

    },

    "build": (callback) => {
        
        ejs.delimiter = config.delimiter || '*';

        if (!config.directories) return console.error("config.directories needs to be an object.");

        if (typeof config.directories.source !== 'string')     return console.error("config.directories.source needs to be a filepath.");
        if (typeof config.directories.builds !== 'string')  return console.error("config.directories.builds needs to be a filepath.");

        var 
            srcdir =    path.resolve(config.directories.source),
            distdir =   path.resolve(config.directories.builds);

        function Build(cb){
            console.log(`Building from ${srcdir}`);
            fs.readdirSync(srcdir).forEach(filename=>{
                var p = path.resolve(srcdir, filename);
                Migrate(p);
            });
            if (typeof cb == 'function') cb();
        }

        // Migrate a file over to distribution.
        function Migrate(p){

            var ext = path.extname(p),
                type = mime.lookup(p);

            if (ext) ext = ext.substring(1);

            config.builds.forEach(distribution=>{
                
                if (fs.existsSync(p) && fs.lstatSync(p).isDirectory()) {
                    console.group(`(${ext}) ${p}`);
                    fs.readdirSync(p).forEach(f=> 
                        Migrate(path.resolve(p, f))
                    );
                    console.groupEnd();
                } else {
                    console.log(`(${ext}) ${p}`);
                    var contents = fs.readFileSync(p);
                    var s = Date.now();
                    var shouldRender = false,
                        shouldDist = true;
                    
                    if(distribution.extensions) distribution.extensions.forEach(x=>{
                         if (ext.toLowerCase() == x.toLowerCase()) shouldRender = true;
                    });

                    var raw = p.replace(srcdir, '').substring(1).replace(/\\/gi, '/');
                    if (config.ignore) config.ignore.forEach(function(path){
                        if (compare(raw, path.replace(/\\/gi, '/'))) shouldDist = false;
                    });
                    if (distribution.ignore) distribution.ignore.forEach(function(path){
                        if (compare(raw, path.replace(/\\/gi, '/'))) shouldDist = false;
                    });
                    
                    var variables = {distribution:{}};
                    
                    if (config.variables) for (let attr in config.variables){
                    
                        for (let v in config.variables) 
                            variables[v] = config.variables[v];
    
                    }
    
                    for(let attr in distribution){
                        if (attr == 'variables') {
                            for (let v in distribution.variables) 
                                variables[v] = distribution.variables[v];
                        } else variables.distribution[attr] = distribution[attr];
                    }
    
                    variables.dir = srcdir; 

                    if (shouldRender) try {
                        ejs.delimiter = config.delimiter || '*';
                        variables.dir = srcdir; 
                        console.log(variables);
                        variables.product = config.product;
                        variables.fn = fn;
                        contents = ejs.render(contents.toString(), variables);
                        console.log('Rendered', p, 'in', `${Date.now()-s}ms.`);
                    } catch (e) {
                        console.error(`[!] Could not render ${p}`, e.message);
                    }

                    var distpath = p.replace(srcdir, path.resolve(distdir, distribution.name));

                    if (shouldDist) mkdirp(path.dirname(distpath), ()=>{
                        fs.writeFileSync(distpath, contents);
                    });

                }
            })
            
        }
 
        // Remove distribution path to rebuild it.
        rimraf(distdir, function(){
            Build(callback);
        });


    },

    "serve": (configuration) => {
        

        console.log(`Starting static file server...`);

        ejs.delimiter = config.delimiter || '*';

        if (!config.directories) return console.error("config.directories needs to be an object.");

        if (typeof config.directories.source !== 'string')     return console.error("config.directories.source needs to be a filepath.");
        if (typeof config.directories.builds !== 'string')  return console.error("config.directories.builds needs to be a filepath.");

        var 
            srcdir =    path.resolve(config.directories.source),
            distdir =   path.resolve(config.directories.builds);


        var server = express();  

        config.builds.forEach(distribution=>{

            console.log('opened: ' + '/' + distribution.name + '/*');
             
            server.get('/' + distribution.name + '/*', (req,res)=>{
        
                if (typeof configFile == 'string') Distruct.config(configFile); 
                console.log(configFile, config.builds[0]);
                
                config.builds.forEach(dist=>{
                    if (dist.name == distribution.name) distribution = dist;
                });

                var p = url.parse(req.url).pathname.substring(('/' + distribution.name + '/').length);
                
                var shouldRender = false, shouldDist = true;
                 
                if (fs.lstatSync(config.directories.source + '/' + p).isDirectory()) {
                    if (p.length>2 && p[p.length-1]!=='/') {
                        res.redirect(p + '/');
                    }
                    console.log('(dir)');
                    p = path.join(p,'index.html');
                }
            
                var ext = path.extname(p).substring(1),
                    type = mime.lookup(p);
                    
                console.log('viewing:', config.directories.source + '/' + p);
                 
                if(distribution.extensions) distribution.extensions.forEach(x=>{
                    if (ext.toLowerCase() == x.toLowerCase()) shouldRender = true;
                });

                var raw = p.replace(srcdir, '').substring(1).replace(/\\/gi, '/');
                if (config.ignore) config.ignore.forEach(function(path){
                    if (compare(raw, path.replace(/\\/gi, '/'))) shouldDist = false;
                });
                if (distribution.ignore) distribution.ignore.forEach(function(path){
                    if (compare(raw, path.replace(/\\/gi, '/'))) shouldDist = false;
                });
                
                var variables = {distribution:{}};
                
                if (config.variables) for (let attr in config.variables) {
                    
                    for (let v in config.variables) 
                        variables[v] = config.variables[v]; 

                }

                for(let attr in distribution){
                    if (attr == 'variables') {
                        for (let v in distribution.variables) 
                            variables[v] = distribution.variables[v];
                    } else variables.distribution[attr] = distribution[attr];
                }

                variables.dir = srcdir; 

                if (!fs.existsSync(path.resolve(config.directories.source,p))) return res.sendStatus(404);
                
                if (shouldRender) {
                    res.setHeader('content-type', type);
                    ejs.delimiter = config.delimiter || '*';
                    variables.fn = fn;
                    variables.product = config.product;
                    res.send(ejs.render(fs.readFileSync(path.resolve(config.directories.source,p)).toString(), variables));
                }
                else res.sendFile(path.resolve(config.directories.source,p));
            });

        });

        if (!config.server) config.server = {};
        server.listen(config.server.port || 3000);
         
    },

    "deploy": () => {

        console.log('Deploying builds...');
        
        if (!config.directories) return console.error("config.directories needs to be an object.");

        if (typeof config.directories.builds !== 'string')  return console.error("config.directories.builds needs to be a filepath.");
 
        var TODO = [];
        config.deployments.forEach(deployment => {

            deployment.builds.forEach(build=>{ 
                var addition = JSON.parse(JSON.stringify(deployment));
                addition.name = build;
                addition.path = path.resolve(config.directories.builds, build);
                TODO.push(addition);
            });
  

        });

        var curr = 0;
        function deploy(){
            if (TODO[curr]) {
                console.log('Deploying ' + TODO[curr].name + '(' + TODO[curr].script + ')');
                var worker = child_process.spawn('node ' + path.resolve(TODO[curr].script) + ' ' + encodeURIComponent(JSON.stringify(TODO[curr])), {shell:true});
                worker.stdout.on('data', data=>{
                    console.log(`[${TODO[curr].name}] ${data}`);
                });
                worker.stderr.on('data', data=>{
                    console.error(`[${TODO[curr].name}] ${data}`);
                });
                worker.on('exit', code=>{
                    console.log(`${TODO[curr].name} exited with code: ${code}`);
                    curr++;
                    deploy();
                })
            } else console.log('done.');
        }

        deploy();

    },

    
 
}

module.exports = Distruct;