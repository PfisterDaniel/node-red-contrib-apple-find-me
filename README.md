
[![Current Release](https://img.shields.io/github/v/release/PfisterDaniel/node-red-apple-find-me.svg?colorB=4cc61e)](https://github.com/PfisterDaniel/node-red-apple-find-me/releases/latest)


# [node-red](https://github.com/PfisterDaniel/node-red-apple-find-me.git)-apple-find-me node
This is a node-red node to get the current locations and other metrics of connected Apple devices.

It work's without 2-Factor-Authentication (2FA) and retrive all connected devices include family devices.



## Installation
[![NPM](https://nodei.co/npm/node-red-apple-find-me.png)](https://npmjs.org/package/node-red-apple-find-me)

Install from your Node-RED Manage Palette

or

Install using npm

    $ npm install node-red-apple-find-me

Redmatic:

    $ source /usr/local/addons/redmatic/home/.profile
    $ /usr/local/addons/redmatic/var
    $ npm install --save --no-package-lock --global-style --save-prefix="~" --production node-red-apple-find-me


## Emample:
![NodeExample](images/node.png)



#### Parameter:
| Parameter | Description |
| ------ | ------ |
| AppleID | self explanatory |
| Password | self explanatory |
| Use Family Entrys | Shows devices of the family (true / false) |
| Use Geo API | OpenStreetMaps, HereMaps or GoogleMaps (HereMaps and GoogleMaps needs an API-KEY) |
| Trigger Interval | How often should the devices be updated |
| Places | Define locations that should be specified in the payload if the device is within a 150 meter radius |



## How to use
  * Add **Apple Find me** node your flow
  * Create Account-Information
  * Setting Properties and enjoy



## Features
  * Define places
  * Retriev device metrics (ModelName, ModelImage, DeviceID, DisplayName, BatteryLevel, BatteryState)
  * Retriev location information (Latitude, Longitude, CurrentPlace, CurrentAddress, OSM-Url, GoogleMaps-Url)
  * Run Find my iPhone
  * Send Message to an iOS Device


## Example Payload (Locate my Devices):
```yaml
{
       "<ModelType> e.g: MacBook Pro or iPhone":[
          {
             "modelName":"<ModelName> e.g: MacBook Pro 13\"",
             "modelImageLink":"<ModelImageLink>",
             "deviceID":"<Unique DeviceID>",
             "displayName":"<DiviceName> e.g: Daniel's MacBook Pro",
             "batteryLevel":"<BatteryLevel in percent> e.g 53",
             "batteryState":"<BatteryStatus> e.g: CHARGING",
             "locationInfo":{
                "altitude":0,
                "latitude":0.00000000000,
                "longitude":0.00000000000,
                "isInaccurate":false,
                "isOld":false,
                "positionType":"Wifi or GPS",
                "horizontalAccuracy":"<Accuracy in meters> e.g: 65,
                "verticalAccuracy":0,
                "currentPlace":"<if device in place then its here the name of place when distance < 150 meters>",
                "currentAddress":{<Address-Object from OpenStreetMap, HereMap or GoogleMaps>},
                "osmUrl":"<OpenStreetMaps Url>",
                "googleUrl":"<GoogleMaps Url>",
                "locationTimeStamp":"<TimeStamp of last location> e.g: 2020-11-10 14:51:12"
             },
             "refreshTimeStamp":"<RefreshTimeStamp> e.g: 2020-11-10 14:54:22"
          }
       ]
    }
 }
 ```
## Changelog
| Version | Description |
| ------ | ----------- |
| 1.0.0 | Initial Version |
| 1.0.1 | Add BatteryStatus |
| 1.0.2 | Nodes now available through the Node-Red palette |
| 1.0.3 | Bug with Places solved |
| 1.0.4 | Added Find my iPhone and send message, Geolocation GoogleMaps |

## Bugs and feature requests
Please create an issue in [GitHub](https://github.com/PfisterDaniel/node-red-apple-find-me/issues)