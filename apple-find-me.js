module.exports = function(RED) {
    "use strict";

    var urllib = require("urllib");
    var schedule = require('node-schedule');
    var moment = require('moment-timezone');
    var GeoPoint = require('geopoint');

    function icloudPoll(config){
        RED.nodes.createNode(this, config);
        var node = this;
        this.repeat = 300000;  // every 10 Seconds
        this.interval_id = null;
        var username = this.credentials.username;
        var password = this.credentials.password;

        
        
        this.interval_id = setInterval( function() {
            node.emit("input",{});
        }, this.repeat );


        this.on('input', function(msg) {
            //Hier Function....
            if (username == "" || password == "") { 
                node.status({ fill: "red", shape: "dot", text: "No credentials" });
            }else{
                node.status({ fill: "blue", shape: "dot", text: "Run Request" });
                var headers = {
                    "Accept-Language": "de-DE", 
                    "User-Agent": "FindMyiPhone/500 CFNetwork/758.4.3 Darwin/15.5.0", 
                    "Authorization": "Basic " + Buffer.from(username+ ":" + password).toString('base64'), 
                    "X-Apple-Realm-Support": "1.0", 
                    "X-Apple-AuthScheme": "UserIDGuest", 
                    "X-Apple-Find-API-Ver": "3.0"
                };
                //adapter.log.info(JSON.stringify(headers));
                var jsonDataObj = {"clientContext": {"appVersion": "7.0", "fmly": "true"} };
             
                urllib.request('https://fmipmobile.icloud.com/fmipservice/device/' + username + '/initClient', {
                    method: 'POST',
                    headers: headers,
                    rejectUnauthorized: false,
                    dataType: 'json',
                    content: JSON.stringify(jsonDataObj)
                    }, function (err, data, res) {
                        if (!err && res.statusCode == 200){
                            msg.payload = {"statusCode": res.statusCode, "response": data};
                            node.status({ fill: "green", shape: "dot", text: "Status: 200" });
                        }else{
                            //Ignore StatusCode -2
                            if(res.statusCode == -2){
                                msg.payload = {"statusCode": res.statusCode, "response": null};
                                node.status({ fill: "yellow", shape: "dot", text: "Status: -2" });
                            }else{
                                msg.payload ={"statusCode": res.statusCode, "response": null};
                                node.status({ fill: "red", shape: "dot", text: "Status: " +  res.statusCode});
                            }
                        }
                        
                        node.send(msg);
                });

            
            }
            


        });

        this.on("close", function() {
            if (this.interval_id !== null) {
                clearInterval(this.interval_id);
            }
        });

        node.emit("input",{});
        
        
    }
    

    RED.nodes.registerType("apple-find-me",icloudPoll,{
        credentials: {
            username: {type:"text"},
            password: {type:"password"}
        }
    });
}
