module.exports = function(RED) {
    "use strict";

    var urllib = require("urllib");
    var moment = require('moment-timezone');
    var GeoPoint = require('geopoint');
    var bodyParser = require('body-parser');


    //Define Request Header
    var RequestHeader = {
        "Accept-Language": "de-DE",
        "User-Agent": "FindMyiPhone/500 CFNetwork/758.4.3 Darwin/15.5.0",
        "Authorization": "",
        "X-Apple-Realm-Support": "1.0",
        "X-Apple-AuthScheme": "UserIDGuest",
        "X-Apple-Find-API-Ver": "3.0"
    };

    //Constanten
    const RootURL = 'https://fmipmobile.icloud.com/fmipservice/device/';

    function AppleFindMeAccount(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.appleid = this.credentials.appleid;
        node.password = this.credentials.password;
        //node.showfmly = config.showfmly;
        node.timezone = config.timezone;
        node.timeformat = config.timeformat;
        node.timeout = config.timeout;
    }

    function checkICloudWithInvervall(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.credentials = RED.nodes.getNode(config.account);
        this.repeat = config.triggerInterval;
        this.interval_id = null;

        this.interval_id = setInterval(function() {
            node.emit("input", {});
        }, this.repeat);

        this.on('input', async function(msg) {
            //Check if Apple ID and Password is not empty
            if (this.credentials.appleid == "" || this.credentials.appleid == undefined || this.credentials.password == "" || this.credentials.password == undefined) {
                node.status({ fill: "red", shape: "dot", text: "A valid Apple ID is required" });
            }
            //Checking if GeoAPI an API where need's a API-KEY
            else if (config.geoAPI == "HERE" && config.hereMapApiKey == "") {
                node.status({ fill: "red", shape: "dot", text: "HereMap API-Key is required" });
            } else if (config.geoAPI == "GOOGLE" && config.googleMapsApiKey == "") {
                node.status({ fill: "red", shape: "dot", text: "GoogleMaps API-Key is required" });
            } else {
                node.status({});

                //Define Authentication to Request Header
                RequestHeader.Authorization = "Basic " + Buffer.from(this.credentials.appleid + ":" + this.credentials.password).toString('base64');

                //Define Request Content

                //var RequestContent = { "clientContext": { "appVersion": "7.0", "fmly": "" + this.credentials.showfmly + "" } };



                var DeviceRequest = new Promise(rtn => {
                    urllib.request(RootURL + this.credentials.appleid + '/initClient', {
                            method: 'POST',
                            headers: RequestHeader,
                            rejectUnauthorized: false,
                            dataType: 'json',
                            timeout: RED.nodes.getNode(config.account).timeout * 1000,
                            //content: JSON.stringify(RequestContent)
                            content: ''
                        },
                        function(err, data, res) {
                            if (!err && res.statusCode == 200) {
                                var devices = {};

                                //Build Model-List
                                data.content.forEach(function(entry) {
                                    devices[entry.modelDisplayName] = [];
                                });

                                //Build Devices
                                data.content.forEach(async function(entry) {
                                    var DevColor = "";
                                    if (!entry.deviceColor && entry.deviceColor != "" && entry.deviceColor != undefined) {
                                        DevColor = "-" + entry.deviceColor;
                                    }
                                    //Build Image URL
                                    var deviceImageUrlSmall = 'https://statici.icloud.com/fmipmobile/deviceImages-9.0/' + entry.deviceClass + '/' + entry.rawDeviceModel + DevColor + '/online-infobox.png';
                                    var deviceImageUrlMedium = 'https://statici.icloud.com/fmipmobile/deviceImages-9.0/' + entry.deviceClass + '/' + entry.rawDeviceModel + DevColor + '/online-infobox__2x.png';
                                    var deviceImageUrlLarge = 'https://statici.icloud.com/fmipmobile/deviceImages-9.0/' + entry.deviceClass + '/' + entry.rawDeviceModel + DevColor + '/online-infobox__3x.png';

                                    //Check if entry has location object
                                    if (entry.location === undefined || entry.location === null) {
                                        //Entry has no Location Information
                                        var NewDeviceEntryWithoutLocationInfo = {
                                            "modelName": entry.deviceDisplayName,
                                            "modelImageLink_Small": deviceImageUrlSmall,
                                            "modelImageLink_Medium": deviceImageUrlMedium,
                                            "modelImageLink_Large": deviceImageUrlLarge,
                                            "deviceID": entry.id,
                                            "displayName": entry.name,
                                            "batteryLevel": Math.round(entry.batteryLevel * 100),
                                            "batteryState": entry.batteryStatus,
                                            "locationInfo": null,
                                            "refreshTimeStamp": moment(new Date()).tz(RED.nodes.getNode(config.account).timezone).format(RED.nodes.getNode(config.account).timeformat),
                                        };
                                        //Add Entry without LocationInfo-Object
                                        devices[entry.modelDisplayName].push(NewDeviceEntryWithoutLocationInfo);
                                    } else {
                                        var CurrentPlace = "";
                                        //Check if Places are set
                                        if (config.places.length > 0) {
                                            var LocationsWithDistance = [];
                                            var currentLocation = new GeoPoint(entry.location.latitude, entry.location.longitude);

                                            for (var i = 0; i < config.places.length; i++) {
                                                var distanceObj = {
                                                    "name": config.places[i].name,
                                                    "distance": 0
                                                }
                                                var LocationCoordinates = new GeoPoint(parseFloat(config.places[i].lat), parseFloat(config.places[i].lon));
                                                distanceObj.distance = parseInt((currentLocation.distanceTo(LocationCoordinates, true) * 1000).toString().split(".")[0]);
                                                LocationsWithDistance.push(distanceObj);
                                            }

                                            const smallestDistanceValue = LocationsWithDistance.reduce((acc, loc) => acc.distance < loc.distance ? acc : loc);
                                            if (smallestDistanceValue.distance < config.distanceInMeter) {
                                                CurrentPlace = smallestDistanceValue.name;
                                            } else {
                                                CurrentPlace = "UNKNOWN";
                                            }
                                        } else {
                                            CurrentPlace = "<NO PLACES DEFINDED>";
                                        }

                                        //Build Maps URL's
                                        var OSMUrl = "https://www.openstreetmap.org/index.html?lat=" + entry.location.latitude + "&lon=" + entry.location.longitude + "&mlat=" + entry.location.latitude + "&mlon=" + entry.location.longitude + "&zoom=15&layers=M";
                                        var GoogleMapsUrl = "https://www.google.com/maps/place/" + entry.location.latitude + "+" + entry.location.longitude + "/@" + entry.location.latitude + "," + entry.location.longitude + ",15z";

                                        var NewDeviceEntryWithLocationInfo = {
                                            "modelName": entry.deviceDisplayName,
                                            "modelImageLink_Small": deviceImageUrlSmall,
                                            "modelImageLink_Medium": deviceImageUrlMedium,
                                            "modelImageLink_Large": deviceImageUrlLarge,
                                            "deviceID": entry.id,
                                            "displayName": entry.name,
                                            "batteryLevel": Math.round(entry.batteryLevel * 100),
                                            "batteryState": entry.batteryStatus,
                                            "locationInfo": {
                                                "altitude": entry.location.altitude,
                                                "latitude": entry.location.latitude,
                                                "longitude": entry.location.longitude,
                                                "isInaccurate": entry.location.isInaccurate,
                                                "isOld": entry.location.isOld,
                                                "positionType": entry.location.positionType,
                                                "horizontalAccuracy": entry.location.horizontalAccuracy,
                                                "verticalAccuracy": entry.location.verticalAccuracy,
                                                "currentPlace": CurrentPlace,
                                                "currentAddress": null,
                                                "osmUrl": OSMUrl,
                                                "googleUrl": GoogleMapsUrl,
                                                "locationTimeStamp": moment(new Date(entry.location.timeStamp)).tz(RED.nodes.getNode(config.account).timezone).format(RED.nodes.getNode(config.account).timeformat)
                                            },
                                            "refreshTimeStamp": moment(new Date()).tz(RED.nodes.getNode(config.account).timezone).format(RED.nodes.getNode(config.account).timeformat),
                                        };
                                        //Add Entry with LocationInfo-Object
                                        devices[entry.modelDisplayName].push(NewDeviceEntryWithLocationInfo);
                                    }
                                });
                                rtn({ "status": true, "code": 0, "data": devices });
                            } else {
                                rtn({ "status": false, "code": res.statusCode, "data": null });
                            }

                        });
                });

                //Build Default Payload
                msg.payload = {};

                node.status({ fill: "blue", shape: "dot", text: "Fetching Devices..." });
                //Wait for Device-Request
                var DeviceRequestResult = await DeviceRequest;

                if (DeviceRequestResult.status) {
                    msg.payload = DeviceRequestResult.data;
                    var DeviceCounter = 0;
                    for (var prop in DeviceRequestResult.data) {
                        DeviceCounter += DeviceRequestResult.data[prop].length;
                    }
                    node.status({ fill: "green", shape: "dot", text: DeviceCounter + " devices found" });

                    try {
                        for (var item in msg.payload) {
                            for (var device in msg.payload[item]) {
                                if (msg.payload[item][device].locationInfo === undefined || msg.payload[item][device].locationInfo === null) {
                                    continue;
                                } else {

                                    //Build Address-Crawl URL's
                                    var AdressCheckUrlOSM = "https://nominatim.openstreetmap.org/reverse?format=json&accept-language=de-DE&lat=" + msg.payload[item][device].locationInfo.latitude + "&lon=" + msg.payload[item][device].locationInfo.longitude + "&zoom=18&addressdetails=1";
                                    var AddressCheckUrlHereMap = "https://revgeocode.search.hereapi.com/v1/revgeocode?at=" + msg.payload[item][device].locationInfo.latitude.toFixed(6) + "," + msg.payload[item][device].locationInfo.longitude.toFixed(6) + "&apiKey=" + config.hereMapApiKey;
                                    var AddressCheckUrlGoogleMaps = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + msg.payload[item][device].locationInfo.latitude + "," + msg.payload[item][device].locationInfo.longitude + "&language=de&result_type=street_address&key=" + config.googleMapsApiKey;

                                    //Crawl Address in Sub-Request
                                    var crawledAddress = new Promise(rtn => {
                                        //Using HereMapAPI
                                        if (config.geoAPI == "HERE") {
                                            urllib.request(AddressCheckUrlHereMap, {
                                                    method: 'GET',
                                                    rejectUnauthorized: false,
                                                    dataType: 'json',
                                                    timeout: RED.nodes.getNode(config.account).timeout * 1000
                                                },
                                                function(err, data, res) {
                                                    if (!err && res.statusCode == 200) {
                                                        try {
                                                            rtn(data.items[0].address);
                                                        } catch (e) {
                                                            node.error('Error: ' + e);
                                                            node.debug('HereMap-Address: ' + AddressCheckUrlHereMap);
                                                            rtn("<Error: " + e + ">");
                                                        }
                                                    } else if (res.statusCode == 401) {
                                                        rtn("<No valid API-KEY for HereMaps>");
                                                    }
                                                });
                                        } else if (config.geoAPI == "OSM") {
                                            //Using OpenStreetMap-API
                                            urllib.request(AdressCheckUrlOSM, {
                                                    method: 'GET',
                                                    rejectUnauthorized: false,
                                                    dataType: 'json'
                                                },
                                                function(err, data, res) {
                                                    if (!err && res.statusCode == 200) {
                                                        try {
                                                            rtn(data.address);
                                                        } catch (e) {
                                                            node.error('Error: ' + e);
                                                            node.debug('OpenStreetMap-Address: ' + AdressCheckUrlOSM);
                                                            rtn("<Error: " + e + ">");
                                                        }
                                                    } else {
                                                        rtn("<Error on OpenStreetMaps ErrorCode: " + res.satusCode + ">");
                                                    }
                                                });
                                        } else if (config.geoAPI == "GOOGLE") {
                                            //Using GoogleMaps-API
                                            urllib.request(AddressCheckUrlGoogleMaps, {
                                                    method: 'GET',
                                                    rejectUnauthorized: false,
                                                    dataType: 'json',
                                                    timeout: RED.nodes.getNode(config.account).timeout * 1000
                                                },
                                                function(err, data, res) {
                                                    if (!err && res.statusCode == 200) {
                                                        if (data.status == "OK") {
                                                            try {
                                                                rtn({ "address_components": data.results[0].address_components, "formatted_address": data.results[0].formatted_address });
                                                            } catch (e) {
                                                                node.error('Error: ' + e);
                                                                node.debug('GoogleMap-Address: ' + AddressCheckUrlGoogleMaps);
                                                                rtn("<Error: " + e + ">");
                                                            }
                                                        } else {
                                                            rtn("<Error: " + data.status + ">");
                                                        }

                                                    }
                                                });
                                        }
                                    })
                                    msg.payload[item][device].locationInfo.currentAddress = await crawledAddress;
                                }
                            };
                        }
                    } catch (e) {
                        node.status({ fill: "red", shape: "dot", text: JSON.stringify(e) });
                    }

                    //Send Data
                    node.send(msg);
                } else {
                    if (DeviceRequestResult.code == -2) {
                        node.status({ fill: "yellow", shape: "dot", text: "Await next run" });
                    } else if (DeviceRequestResult.code == 401) {
                        node.status({ fill: "red", shape: "dot", text: "404 - Not authorised" });
                        node.emit("close", {});
                    } else if (DeviceRequestResult.code == 404) {
                        node.status({ fill: "red", shape: "dot", text: "404 - Page not found" });
                        node.emit("close", {});
                    } else if (DeviceRequestResult.code == 403) {
                        node.status({ fill: "red", shape: "dot", text: "403 - Please check your Account-Information" });
                        node.emit("close", {});
                    } else {
                        node.status({ fill: "red", shape: "dot", text: "ErrorCode: " + DeviceRequestResult.code });
                        node.emit("close", {});
                    }
                }
            }
        });

        this.on("close", function() {
            if (this.interval_id !== null) {
                clearInterval(this.interval_id);
            }
        });

        node.emit("input", {});
    }

    function checkICloudWithPayload(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.credentials = RED.nodes.getNode(config.account);

        this.on('input', async function(msg) {
            //Check if Apple ID and Password is not empty
            if (this.credentials.appleid == "" || this.credentials.appleid == undefined || this.credentials.password == "" || this.credentials.password == undefined) {
                node.status({ fill: "red", shape: "dot", text: "A valid Apple ID is required" });
            }
            //Checking if GeoAPI an API where need's a API-KEY
            else if (config.geoAPI == "HERE" && config.hereMapApiKey == "") {
                node.status({ fill: "red", shape: "dot", text: "HereMap API-Key is required" });
            } else if (config.geoAPI == "GOOGLE" && config.googleMapsApiKey == "") {
                node.status({ fill: "red", shape: "dot", text: "GoogleMaps API-Key is required" });
            } else {
                node.status({});

                //Define Authentication to Request Header
                RequestHeader.Authorization = "Basic " + Buffer.from(this.credentials.appleid + ":" + this.credentials.password).toString('base64');

                //Define Request Content
                //var RequestContent = { "clientContext": { "appVersion": "7.0", "fmly": "" + this.credentials.showfmly + "" } };



                var DeviceRequest = new Promise(rtn => {
                    urllib.request(RootURL + this.credentials.appleid + '/initClient', {
                            method: 'POST',
                            headers: RequestHeader,
                            rejectUnauthorized: false,
                            dataType: 'json',
                            timeout: RED.nodes.getNode(config.account).timeout * 1000,
                            //content: JSON.stringify(RequestContent)
                            content: ''
                        },
                        function(err, data, res) {
                            if (!err && res.statusCode == 200) {
                                var devices = {};

                                //Build Model-List
                                data.content.forEach(function(entry) {
                                    devices[entry.modelDisplayName] = [];
                                });

                                //Build Devices
                                data.content.forEach(async function(entry) {
                                    var DevColor = "";
                                    if (!entry.deviceColor && entry.deviceColor != "" && entry.deviceColor != undefined) {
                                        DevColor = "-" + entry.deviceColor;
                                    }
                                    //Build Image URL
                                    var deviceImageUrlSmall = 'https://statici.icloud.com/fmipmobile/deviceImages-9.0/' + entry.deviceClass + '/' + entry.rawDeviceModel + DevColor + '/online-infobox.png';
                                    var deviceImageUrlMedium = 'https://statici.icloud.com/fmipmobile/deviceImages-9.0/' + entry.deviceClass + '/' + entry.rawDeviceModel + DevColor + '/online-infobox__2x.png';
                                    var deviceImageUrlLarge = 'https://statici.icloud.com/fmipmobile/deviceImages-9.0/' + entry.deviceClass + '/' + entry.rawDeviceModel + DevColor + '/online-infobox__3x.png';

                                    //Check if entry has location object
                                    if (entry.location === undefined || entry.location === null) {
                                        //Entry has no Location Information
                                        var NewDeviceEntryWithoutLocationInfo = {
                                            "modelName": entry.deviceDisplayName,
                                            "modelImageLink_Small": deviceImageUrlSmall,
                                            "modelImageLink_Medium": deviceImageUrlMedium,
                                            "modelImageLink_Large": deviceImageUrlLarge,
                                            "deviceID": entry.id,
                                            "displayName": entry.name,
                                            "batteryLevel": Math.round(entry.batteryLevel * 100),
                                            "batteryState": entry.batteryStatus,
                                            "locationInfo": null,
                                            "refreshTimeStamp": moment(new Date()).tz(RED.nodes.getNode(config.account).timezone).format(RED.nodes.getNode(config.account).timeformat),
                                        };
                                        //Add Entry without LocationInfo-Object
                                        devices[entry.modelDisplayName].push(NewDeviceEntryWithoutLocationInfo);
                                    } else {
                                        var CurrentPlace = "";
                                        //Check if Places are set
                                        if (config.places.length > 0) {
                                            var LocationsWithDistance = [];
                                            var currentLocation = new GeoPoint(entry.location.latitude, entry.location.longitude);

                                            for (var i = 0; i < config.places.length; i++) {
                                                var distanceObj = {
                                                    "name": config.places[i].name,
                                                    "distance": 0
                                                }
                                                var LocationCoordinates = new GeoPoint(parseFloat(config.places[i].lat), parseFloat(config.places[i].lon));
                                                distanceObj.distance = parseInt((currentLocation.distanceTo(LocationCoordinates, true) * 1000).toString().split(".")[0]);
                                                LocationsWithDistance.push(distanceObj);
                                            }

                                            const smallestDistanceValue = LocationsWithDistance.reduce((acc, loc) => acc.distance < loc.distance ? acc : loc);
                                            if (smallestDistanceValue.distance < config.distanceInMeter) {
                                                CurrentPlace = smallestDistanceValue.name;
                                            } else {
                                                CurrentPlace = "UNKNOWN";
                                            }
                                        } else {
                                            CurrentPlace = "<NO PLACES DEFINDED>";
                                        }

                                        //Build Maps URL's
                                        var OSMUrl = "https://www.openstreetmap.org/index.html?lat=" + entry.location.latitude + "&lon=" + entry.location.longitude + "&mlat=" + entry.location.latitude + "&mlon=" + entry.location.longitude + "&zoom=15&layers=M";
                                        var GoogleMapsUrl = "https://www.google.com/maps/place/" + entry.location.latitude + "+" + entry.location.longitude + "/@" + entry.location.latitude + "," + entry.location.longitude + ",15z";

                                        var NewDeviceEntryWithLocationInfo = {
                                            "modelName": entry.deviceDisplayName,
                                            "modelImageLink_Small": deviceImageUrlSmall,
                                            "modelImageLink_Medium": deviceImageUrlMedium,
                                            "modelImageLink_Large": deviceImageUrlLarge,
                                            "deviceID": entry.id,
                                            "displayName": entry.name,
                                            "batteryLevel": Math.round(entry.batteryLevel * 100),
                                            "batteryState": entry.batteryStatus,
                                            "locationInfo": {
                                                "altitude": entry.location.altitude,
                                                "latitude": entry.location.latitude,
                                                "longitude": entry.location.longitude,
                                                "isInaccurate": entry.location.isInaccurate,
                                                "isOld": entry.location.isOld,
                                                "positionType": entry.location.positionType,
                                                "horizontalAccuracy": entry.location.horizontalAccuracy,
                                                "verticalAccuracy": entry.location.verticalAccuracy,
                                                "currentPlace": CurrentPlace,
                                                "currentAddress": null,
                                                "osmUrl": OSMUrl,
                                                "googleUrl": GoogleMapsUrl,
                                                "locationTimeStamp": moment(new Date(entry.location.timeStamp)).tz(RED.nodes.getNode(config.account).timezone).format(RED.nodes.getNode(config.account).timeformat)
                                            },
                                            "refreshTimeStamp": moment(new Date()).tz(RED.nodes.getNode(config.account).timezone).format(RED.nodes.getNode(config.account).timeformat),
                                        };
                                        //Add Entry with LocationInfo-Object
                                        devices[entry.modelDisplayName].push(NewDeviceEntryWithLocationInfo);
                                    }
                                });
                                rtn({ "status": true, "code": 0, "data": devices });
                            } else {
                                rtn({ "status": false, "code": res.statusCode, "data": null });
                            }

                        });
                });

                //Build Default Payload
                msg.payload = {};

                node.status({ fill: "blue", shape: "dot", text: "Fetching Devices..." });
                //Wait for Device-Request
                var DeviceRequestResult = await DeviceRequest;

                if (DeviceRequestResult.status) {
                    msg.payload = DeviceRequestResult.data;
                    var DeviceCounter = 0;
                    for (var prop in DeviceRequestResult.data) {
                        DeviceCounter += DeviceRequestResult.data[prop].length;
                    }
                    node.status({ fill: "green", shape: "dot", text: DeviceCounter + " devices found" });

                    try {
                        for (var item in msg.payload) {
                            for (var device in msg.payload[item]) {
                                if (msg.payload[item][device].locationInfo === undefined || msg.payload[item][device].locationInfo === null) {
                                    continue;
                                } else {

                                    //Build Address-Crawl URL's
                                    var AdressCheckUrlOSM = "https://nominatim.openstreetmap.org/reverse?format=json&accept-language=de-DE&lat=" + msg.payload[item][device].locationInfo.latitude + "&lon=" + msg.payload[item][device].locationInfo.longitude + "&zoom=18&addressdetails=1";
                                    var AddressCheckUrlHereMap = "https://revgeocode.search.hereapi.com/v1/revgeocode?at=" + msg.payload[item][device].locationInfo.latitude.toFixed(6) + "," + msg.payload[item][device].locationInfo.longitude.toFixed(6) + "&apiKey=" + config.hereMapApiKey;
                                    var AddressCheckUrlGoogleMaps = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + msg.payload[item][device].locationInfo.latitude + "," + msg.payload[item][device].locationInfo.longitude + "&language=de&result_type=street_address&key=" + config.googleMapsApiKey;

                                    //Crawl Address in Sub-Request
                                    var crawledAddress = new Promise(rtn => {
                                        //Using HereMapAPI
                                        if (config.geoAPI == "HERE") {
                                            urllib.request(AddressCheckUrlHereMap, {
                                                    method: 'GET',
                                                    rejectUnauthorized: false,
                                                    dataType: 'json',
                                                    timeout: RED.nodes.getNode(config.account).timeout * 1000
                                                },
                                                function(err, data, res) {
                                                    if (!err && res.statusCode == 200) {
                                                        rtn(data.items[0].address);
                                                    } else if (res.statusCode == 401) {
                                                        rtn("<No valid API-KEY for HereMaps>");
                                                    }
                                                });
                                        } else if (config.geoAPI == "OSM") {
                                            //Using OpenStreetMap-API
                                            urllib.request(AdressCheckUrlOSM, {
                                                    method: 'GET',
                                                    rejectUnauthorized: false,
                                                    dataType: 'json',
                                                    timeout: RED.nodes.getNode(config.account).timeout * 1000
                                                },
                                                function(err, data, res) {
                                                    if (!err && res.statusCode == 200) {
                                                        rtn(data.address);
                                                    } else {
                                                        rtn("<Error on OpenStreetMaps ErrorCode: " + res.satusCode + ">");
                                                    }
                                                });
                                        } else if (config.geoAPI == "GOOGLE") {
                                            //Using GoogleMaps-API
                                            urllib.request(AddressCheckUrlGoogleMaps, {
                                                    method: 'GET',
                                                    rejectUnauthorized: false,
                                                    dataType: 'json',
                                                    timeout: RED.nodes.getNode(config.account).timeout * 1000
                                                },
                                                function(err, data, res) {
                                                    if (!err && res.statusCode == 200) {
                                                        if (data.status == "OK") {
                                                            rtn({ "address_components": data.results[0].address_components, "formatted_address": data.results[0].formatted_address });
                                                        } else {
                                                            rtn("<Error: " + data.status + ">");
                                                        }

                                                    }
                                                });
                                        }
                                    })
                                    msg.payload[item][device].locationInfo.currentAddress = await crawledAddress;
                                }
                            };
                        }
                    } catch (e) {
                        node.status({ fill: "red", shape: "dot", text: JSON.stringify(e) });
                    }

                    //Send Data
                    node.send(msg);
                } else {
                    if (DeviceRequestResult.code == -2) {
                        node.status({ fill: "yellow", shape: "dot", text: "Await next run" });
                    } else if (DeviceRequestResult.code == 401) {
                        node.status({ fill: "red", shape: "dot", text: "404 - Not authorised" });
                        node.emit("close", {});
                    } else if (DeviceRequestResult.code == 404) {
                        node.status({ fill: "red", shape: "dot", text: "404 - Page not found" });
                        node.emit("close", {});
                    } else if (DeviceRequestResult.code == 403) {
                        node.status({ fill: "red", shape: "dot", text: "403 - Please check your Account-Information" });
                        node.emit("close", {});
                    } else {
                        node.status({ fill: "red", shape: "dot", text: "ErrorCode: " + DeviceRequestResult.code });
                        node.emit("close", {});
                    }
                }
            }
        });
    }


    function playSound(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.credentials = RED.nodes.getNode(config.account);
        var DeviceID = "";

        this.on('input', async function(msg) {

            try {
                if (config.inputtype === "msg") {
                    var DeviceIDObject = eval("msg." + config.deviceid)
                    DeviceID = DeviceIDObject;
                } else {
                    DeviceID = config.deviceid;
                }
            } catch (e) {
                node.status({ fill: "red", shape: "dot", text: "Please use a valid device id" });
            }
            if (this.credentials.appleid == "" || this.credentials.appleid == undefined || this.credentials.password == "" || this.credentials.password == undefined) {
                node.status({ fill: "red", shape: "dot", text: "A valid Apple ID is required" });
            } else if (config.deviceid == undefined || config.deviceid == "") {
                node.status({ fill: "red", shape: "dot", text: "A DeviceID is required" });
            } else {
                node.status({});
                node.status({ fill: "blue", shape: "dot", text: "Sending..." });

                //Define Authentication to Request Header
                RequestHeader.Authorization = "Basic " + Buffer.from(this.credentials.appleid + ":" + this.credentials.password).toString('base64');

                //Define Request Content
                var RequestContent = { "clientContext": { "appVersion": "7.0", "fmly": true }, "device": DeviceID, "subject": config.subject };

                urllib.request(RootURL + this.credentials.appleid + '/playSound', {
                        method: 'POST',
                        headers: RequestHeader,
                        rejectUnauthorized: false,
                        dataType: 'json',
                        timeout: RED.nodes.getNode(config.account).timeout * 1000,
                        content: JSON.stringify(RequestContent)
                    },
                    function(err, data, res) {
                        if (!err && res.statusCode == 200) {
                            msg.payload = { "status": "successfully", "statusCode": 0, "message": "Sound was played successfully" }
                            node.status({ fill: "green", shape: "dot", text: "Successfully" });
                        } else if (res.statusCode == 500) {
                            msg.payload = { "status": "failed", "statusCode": res.statusCode, "message": res.statusMessage }
                            node.status({ fill: "red", shape: "dot", text: "Sending failed. Check your DeviceID" });
                        } else {
                            msg.payload = { "status": "failed", "statusCode": res.statusCode, "message": res.statusMessage }
                            node.status({ fill: "red", shape: "dot", text: "Sending failed. ErrorCode: " + res.statusCode });
                        }
                        node.send(msg);
                    }
                );
            }
        })
    }



    function sendMessage(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.credentials = RED.nodes.getNode(config.account);
        var DeviceID = "";
        var Text = "";

        this.on('input', async function(msg) {
            try {
                if (config.inputtype === "msg") {
                    var DeviceIDObject = eval("msg." + config.deviceid)
                    DeviceID = DeviceIDObject;
                } else {
                    DeviceID = config.deviceid;
                }
            } catch (e) {
                node.status({ fill: "red", shape: "dot", text: "Please use a valid device id" });
            }
            try {
                if (config.inputtypetext === "msg") {
                    var TextObject = eval("msg." + config.text)
                    Text = TextObject;
                } else {
                    Text = config.text;
                }
            } catch (e) {
                node.status({ fill: "red", shape: "dot", text: "Please use a valid device id" });
            }

            if (this.credentials.appleid == "" || this.credentials.appleid == undefined || this.credentials.password == "" || this.credentials.password == undefined) {
                node.status({ fill: "red", shape: "dot", text: "A valid Apple ID is required" });
            } else if (config.deviceid == undefined || config.deviceid == "") {
                node.status({ fill: "red", shape: "dot", text: "A device is required" });
            } else if (config.text == undefined || config.text == "") {
                node.status({ fill: "red", shape: "dot", text: "A message is required" });
            } else {
                node.status({});
                node.status({ fill: "blue", shape: "dot", text: "Sending..." });

                //Define Authentication to Request Header
                RequestHeader.Authorization = "Basic " + Buffer.from(this.credentials.appleid + ":" + this.credentials.password).toString('base64');

                //Define Request Content
                var RequestContent = {
                    "clientContext": {
                        "appVersion": "7.0",
                        "fmly": true
                    },
                    "device": DeviceID,
                    "sound": config.playsound,
                    "subject": config.subject,
                    "text": Text,
                    "userText": true
                };

                urllib.request(RootURL + this.credentials.appleid + '/sendMessage', {
                        method: 'POST',
                        headers: RequestHeader,
                        rejectUnauthorized: false,
                        dataType: 'json',
                        timeout: RED.nodes.getNode(config.account).timeout * 1000,
                        content: JSON.stringify(RequestContent)
                    },
                    function(err, data, res) {
                        if (!err && res.statusCode == 200) {
                            msg.payload = { "status": "successfully", "statusCode": 0, "message": "Message was send successfully" }
                            node.status({ fill: "green", shape: "dot", text: "Successfully" });
                        } else if (res.statusCode == 500) {
                            msg.payload = { "status": "failed", "statusCode": res.statusCode, "message": res.statusMessage }
                            node.status({ fill: "red", shape: "dot", text: "Sending failed. Check your DeviceID" });
                        } else {
                            msg.payload = { "status": "failed", "statusCode": res.statusCode, "message": res.statusMessage }
                            node.status({ fill: "red", shape: "dot", text: "Sending failed. ErrorCode: " + res.statusCode });
                        }
                        node.send(msg);
                    }
                );
            }
        })
    }

    RED.httpAdmin.use('/apple-find-me-account/new-account', bodyParser.json());
    RED.httpAdmin.post('/apple-find-me-account/new-account', async function(req, res) {
        var appleid = req.body.appleid;
        var password = req.body.password;
        var id = req.body.id;
        //var showfmly = req.body.showfmly;
        var timezone = req.body.timezone;
        var timeformat = req.body.timeformat;

    });

    RED.nodes.registerType("apple-find-me-account", AppleFindMeAccount, {
        credentials: {
            appleid: { type: "text" },
            password: { type: "password" }
        }
    });

    RED.nodes.registerType("apple-find-me", checkICloudWithInvervall);
    RED.nodes.registerType("apple-find-me-with-payload", checkICloudWithPayload);
    RED.nodes.registerType("apple-find-me-playsound", playSound);
    RED.nodes.registerType("apple-find-me-sendmessage", sendMessage);
}