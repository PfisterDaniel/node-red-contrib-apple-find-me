module.exports = function(RED) {
    "use strict";

    var urllib = require("urllib");
    var moment = require('moment-timezone');
    var GeoPoint = require('geopoint');




    function icloudPoll(config){
        RED.nodes.createNode(this, config);
        var node = this;
        this.repeat = config.triggerinterval;
        this.interval_id = null;

        this.interval_id = setInterval( function() {
            node.emit("input",{});
        }, this.repeat );

        this.on('input', async function(msg) {
            //Check if Apple ID and Password is not empty
            if (this.credentials.appleid == "" || this.credentials.appleid == undefined || this.credentials.password == "" || this.credentials.password == undefined) 
            { 
                node.status({ fill: "red", shape: "dot", text: "Apple ID is required" });
            }
            else if(config.useHereMapAPI && config.hereMapApiKey == "")
            {
                node.status({ fill: "red", shape: "dot", text: "HereMap API-Key is required" });
            }
            else
            {
                node.status({});
                //node.status({ fill: "blue", shape: "dot", text: "Run Request" });
                //Define Request Header
                var RequestHeader = {
                    "Accept-Language": "de-DE", 
                    "User-Agent": "FindMyiPhone/500 CFNetwork/758.4.3 Darwin/15.5.0", 
                    "Authorization": "Basic " + Buffer.from(this.credentials.appleid+ ":" + this.credentials.password).toString('base64'), 
                    "X-Apple-Realm-Support": "1.0", 
                    "X-Apple-AuthScheme": "UserIDGuest", 
                    "X-Apple-Find-API-Ver": "3.0"
                };
                
                //Define Request Content
                var RequestContent = {"clientContext": {"appVersion": "7.0", "fmly": "" + config.showfmly + ""} };
             
                //Build Default Payload
                msg.payload = {"places": config.places, "devices" : {}};

                node.status({ fill: "blue", shape: "dot", text: "Fetching Devices..." });

               

                var DeviceRequest = new Promise(rtn => {
                    urllib.request('https://fmipmobile.icloud.com/fmipservice/device/' + this.credentials.appleid + '/initClient', { 
                        method: 'POST', 
                        headers: RequestHeader, 
                        rejectUnauthorized: false, 
                        dataType: 'json', 
                        content: JSON.stringify(RequestContent)
                    }, 
                    function (err, data, res) {
                        if (!err && res.statusCode == 200){
                            var devices = {};

                            //Build Model-List
                            data.content.forEach(function(entry) {
                                devices[entry.modelDisplayName] = [];
                            });

                            //Build Devices
                            data.content.forEach(async function(entry) { 
                                var DevColor = "";
                                if(!entry.deviceColor && entry.deviceColor != "" && entry.deviceColor != undefined ){
                                    DevColor = "-" + entry.deviceColor;
                                }
                                //Build Image URL
                                var deviceImageUrl = 'https://statici.icloud.com/fmipmobile/deviceImages-9.0/' + entry.deviceClass + '/' + entry.rawDeviceModel + DevColor + '/online-infobox.png';
                                //Check if entry has location object
                                if (entry.location === undefined || entry.location === null) 
                                {
                                    //Entry has no Location Information
                                    var NewDeviceEntryWithoutLocationInfo= {  
                                        "modelName": entry.deviceDisplayName,
                                        "modelImageLink": deviceImageUrl,
                                        "deviceID": entry.id,
                                        "displayName": entry.name,
                                        "batteryLevel": Math.round(entry.batteryLevel * 100),
                                        "batteryState": entry.batteryStatus,
                                        "locationInfo": null,
                                        "refreshTimeStamp":  moment(new Date()).tz('Europe/Berlin').format('YYYY-MM-DD HH:mm:ss'),
                                    };
                                    //Add Entry without LocationInfo-Object
                                    devices[entry.modelDisplayName].push(NewDeviceEntryWithoutLocationInfo);
                                }
                                else
                                {
                                    var CurrentPlace = "";
                                    //Check if Locations are set
                                    if(config.places.length > 0)
                                    {
                                        var LocationsWithDistance = [];
                                        var currentLocation = new GeoPoint(entry.location.latitude, entry.location.longitude);

                                        for (var i = 0; i < config.places.length; i++) 
                                        {
                                            var distanceObj = {
                                                "name": config.places[i].name,
                                                "distance": 0
                                            }
                                            var LocationCoordinates = new GeoPoint(parseFloat(config.places[i].lat), parseFloat(config.places[i].lon));
                                            distanceObj.distance = parseInt((currentLocation.distanceTo(LocationCoordinates, true) * 1000).toString().split(".")[0]);
                                            LocationsWithDistance.push(distanceObj);
                                        }

                                        const smallestDistanceValue = LocationsWithDistance.reduce((acc, loc) => acc.distance < loc.distance ? acc : loc);
                                        if(smallestDistanceValue.distance < 150)
                                        {
                                            CurrentPlace = smallestDistanceValue.name;
                                        }
                                        else
                                        {
                                            CurrentPlace = "UNKNOWN";
                                        }
                                    }else{
                                        CurrentPlace = "<NO PLACES DEFINDED>";
                                    }

                                    //Build Maps URL's
                                    var OSMUrl = "https://www.openstreetmap.org/index.html?lat="+entry.location.latitude+"&lon="+entry.location.longitude+"&mlat="+entry.location.latitude+"&mlon="+entry.location.longitude+"&zoom=15&layers=M";
                                    var GoogleMapsUrl = "https://www.google.com/maps/place/"+entry.location.latitude+"+"+entry.location.longitude+"/@"+entry.location.latitude+","+entry.location.longitude+",15z";

                                    var NewDeviceEntryWithLocationInfo = {  
                                        "modelName": entry.deviceDisplayName,
                                        "modelImageLink": deviceImageUrl,
                                        "deviceID": entry.id,
                                        "displayName": entry.name,
                                        "batteryLevel": Math.round(entry.batteryLevel * 100),
                                        "batteryState": entry.batteryStatus,
                                        "locationInfo": {
                                            "altitude" : entry.location.altitude,
                                            "latitude" : entry.location.latitude,
                                            "longitude" : entry.location.longitude,
                                            "isInaccurate" : entry.location.isInaccurate,
                                            "isOld" : entry.location.isOld,
                                            "positionType" : entry.location.positionType,
                                            "horizontalAccuracy" : entry.location.horizontalAccuracy,
                                            "verticalAccuracy" : entry.location.verticalAccuracy,
                                            "currentPlace": CurrentPlace,
                                            "currentAddress": null,
                                            "osmUrl" : OSMUrl,
                                            "googleUrl": GoogleMapsUrl,
                                            "locationTimeStamp" : moment(new Date(entry.location.timeStamp)).tz('Europe/Berlin').format('YYYY-MM-DD HH:mm')
                                        },
                                        "refreshTimeStamp":  moment(new Date()).tz('Europe/Berlin').format('YYYY-MM-DD HH:mm:ss'),
                                    };
                                    //Add Entry with LocationInfo-Object
                                    devices[entry.modelDisplayName].push(NewDeviceEntryWithLocationInfo);     
                                }
                            });
                            rtn({"status": true, "code": 0, "data":devices});
                        }else{
                            rtn({"status": false, "code": res.statusCode, "data": null});
                        }

                    });
                });

                //Wait for Device-Request
                var DeviceRequestResult = await DeviceRequest;
                
                if(DeviceRequestResult.status){
                    msg.payload.devices = DeviceRequestResult.data;
                    var DeviceCounter = 0;
                    for (var prop in DeviceRequestResult.data) {
                        DeviceCounter += DeviceRequestResult.data[prop].length;
                    }
                    node.status({ fill: "green", shape: "dot", text: DeviceCounter + " Devices found" });

                    try{
                    for (var item in msg.payload.devices) {
                        for (var device in msg.payload.devices[item]) {
                            if (msg.payload.devices[item][device].locationInfo === undefined || msg.payload.devices[item][device].locationInfo === null){
                                continue;
                            }else{

                                //Build Address-Crawl URL's
                                var AdressCheckUrlOSM = "https://nominatim.openstreetmap.org/reverse?format=json&accept-language=de-DE&lat="+msg.payload.devices[item][device].locationInfo.latitude+"&lon="+msg.payload.devices[item][device].locationInfo.longitude+"&zoom=18&addressdetails=1";
                                var AddressCheckUrlHereMap = "https://revgeocode.search.hereapi.com/v1/revgeocode?at=" + msg.payload.devices[item][device].locationInfo.latitude.toFixed(6) + "," + msg.payload.devices[item][device].locationInfo.longitude.toFixed(6)  + "&apiKey=" + config.hereMapApiKey;

                                //Crawl Address in Sub-Request
                                var crawledAddress = new Promise(rtn => {
                                    //Using HereMapAPI
                                    if(config.useHereMapAPI){
                                        urllib.request(AddressCheckUrlHereMap, {
                                            method: 'GET',
                                            rejectUnauthorized: false,
                                            dataType : 'json'
                                        }, 
                                        function (err, data, res) {
                                            if (!err && res.statusCode == 200){
                                                rtn(data.items[0].address);
                                            }else if(res.statusCode == 401){
                                                rtn("<No valid API-KEY for HereMaps>");

                                            }
                                        });
                                    }else{
                                        //Using OpenStreetMap-API
                                        urllib.request(AdressCheckUrlOSM, {
                                            method: 'GET',
                                            rejectUnauthorized: false,
                                            dataType : 'json'
                                        }, 
                                        function (err, data, res) {
                                            if (!err && res.statusCode == 200){
                                                rtn(data.address);
                                            }
                                        });
                                    }
                                })
                                msg.payload.devices[item][device].locationInfo.currentAddress = await crawledAddress;
                            }
                        };
                    }
                    }catch(e){
                        node.status({ fill: "red", shape: "dot", text:JSON.stringify(e) });
                    }

                    //Send Data
                    node.send(msg);  
                }else{
                    if(res.statusCode == -2){
                        node.status({ fill: "yellow", shape: "dot", text: "Await next run" });
                    }else if (res.statusCode == 401){
                        node.status({ fill: "red", shape: "dot", text: "Not authorised"});
                        node.emit("close",{});
                    }else if (res.statusCode == 404){
                            node.status({ fill: "red", shape: "dot", text: "Page not found"});
                            node.emit("close",{});
                    }else{
                        node.status({ fill: "red", shape: "dot", text: "ErrorCode: " +  res.statusCode});
                        node.emit("close",{});
                    }
                }
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
            appleid: {type:"text"},
            password: {type:"password"}
        }
    });
}
