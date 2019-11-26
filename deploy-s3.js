var distribution = JSON.parse(decodeURIComponent(process.argv[2]));
var credentials = require("./.credentials.json");
var config = require('./config.json');


// Deploy to S3.
if (distribution.name == 'web') {

    const AWS = require('aws-sdk');
    const s3 = new AWS.S3(credentials.aws);
    var path = require("path");
    var fs = require('fs');
    
    const uploadDir = function(s3Path, bucketName) {
     
        function walkSync(currentDirPath, callback) {
            fs.readdirSync(currentDirPath).forEach(function (name) {
                var filePath = path.join(currentDirPath, name);
                var stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    callback(filePath, stat);
                } else if (stat.isDirectory()) {
                    walkSync(filePath, callback);
                }
            });
        }
    
        walkSync(s3Path, function(filePath, stat) {
            let bucketPath = filePath.substring(s3Path.length+1);
            let params = {Bucket: bucketName, Key: bucketPath, Body: fs.readFileSync(filePath) };
            s3.putObject(params, function(err, data) {
                if (err) {
                    console.log(err)
                } else {
                    console.log('Successfully uploaded '+ bucketPath +' to ' + bucketName);
                }
            });
    
        });
    };
    
    uploadDir(distribution.path, "distruct-test/" + distribution.name);

}
