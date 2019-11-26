# distruct 1.0
This framework was built to compile client side code using EJS templating, ready for multi-region available client code. 

This is best used for client code hosted on CloudFront, able to be replicated and cached.


## /src
Your code goes here, with the ability to use EJS with the * delimiter for dynamic compiling. 

### Include files into a single file.
```
<*-include(`${dir}/input.css`)*>
<*-include(`${dir}/output.css`)*>
<*-include(`${dir}/frame.css`)*>
```

This will pull the separate css files into one file when /dist is built.

## /dist
Your compiled code will deploy here, based on your configuration. The root folders in this directory represent your distribution, like web, desktop, mobile, etc.

## config.json

### product
Product information can be found here. 

### distributions
This is an array of objects, each object being the configuration of your distribution. You can use these variables in your src:
```
This is the <*=distribution.name*> version.
```

You can specify custom distribution variables in the variables object:

#### config.json
```json
{
    "name":         "web",
    "delimiter":    "*",
    "extensions":   ["css", "js", "html", "json"],

    "variables": {
        "meta": {
            "robots": "index, follow"
        }
    }
}
```

#### src/head.ejs
```javascript
<* 
    if (typeof meta == 'object') { 
        for(let name in meta){
            var content = meta[name];
-*>
        <meta name="<*= name *>" content="<*= content *>" />
<*
        }
    } 
-*>
```

This generates a list of meta tags based on what's in the variables.meta object. You can then include this in your index.html files:

```html
<head>
    <title>Hello World!</title>
    <*- include(`${dir}/head.ejs`) *>
</head>
```

When the distribution builds, this include reference will be replaced with a list of meta tags.


## Express WebServer

By configuring the "server" portion of the config.json file you can define a port. If no port is defined, 3000 will be used. 

This webserver will serve the compiled /dist statically.