const Influx = require('influx'),
    config = require('config'),
    cron = require('node-cron'),
    DarkSky = require('darksky-node/lib/darksky-api')

const generalConfig = config.get('general'),
    influxConfig = config.get('influxdb'),
    darkskyConfig = config.get('darksky')

if (!darkskyConfig.key) {
    throw new Error('DarkSky key should be provided')
}

const influx = new Influx.InfluxDB({
    host: influxConfig.host,
    port: influxConfig.port,
    database: influxConfig.database,
    username: influxConfig.username,
    password: influxConfig.password,
    schema: [
        {
            measurement: 'weather',
            tags: ['source'],
            fields: {
                temperature: Influx.FieldType.FLOAT,
                apparent_temperature: Influx.FieldType.FLOAT,
                dew_point: Influx.FieldType.FLOAT,
                humidity: Influx.FieldType.FLOAT,
                wind_speed: Influx.FieldType.FLOAT,
                wind_bearing: Influx.FieldType.FLOAT,
                cloud_cover: Influx.FieldType.FLOAT,
                pressure: Influx.FieldType.FLOAT,
                ozone: Influx.FieldType.FLOAT,
                uv_index: Influx.FieldType.FLOAT,
                visibility: Influx.FieldType.FLOAT,
                precip_intensity: Influx.FieldType.FLOAT,
                precip_probability: Influx.FieldType.FLOAT,
                nearest_storm_distance: Influx.FieldType.FLOAT,
                nearest_storm_bearing: Influx.FieldType.FLOAT,
                sunrise_time: Influx.FieldType.INTEGER,
                sunset_time: Influx.FieldType.INTEGER,
                sun_status: Influx.FieldType.INTEGER,
            }
        },
        {
            measurement: 'forecast',
            tags: ['source'],
            fields: {
                temperature_high: Influx.FieldType.FLOAT,
                apparent_temperature_high: Influx.FieldType.FLOAT,
                temperature_low: Influx.FieldType.FLOAT,
                apparent_temperature_low: Influx.FieldType.FLOAT,
                temperature_max: Influx.FieldType.FLOAT,
                apparent_temperature_max: Influx.FieldType.FLOAT,
                temperature_min: Influx.FieldType.FLOAT,
                apparent_temperature_min: Influx.FieldType.FLOAT,
                dew_point: Influx.FieldType.FLOAT,
                humidity: Influx.FieldType.FLOAT,
                wind_speed: Influx.FieldType.FLOAT,
                wind_bearing: Influx.FieldType.FLOAT,
                cloud_cover: Influx.FieldType.FLOAT,
                pressure: Influx.FieldType.FLOAT,
                ozone: Influx.FieldType.FLOAT,
                uv_index: Influx.FieldType.FLOAT,
                visibility: Influx.FieldType.FLOAT,
                precip_intensity: Influx.FieldType.FLOAT,
                precip_probability: Influx.FieldType.FLOAT,
                sun_status: Influx.FieldType.INTEGER,
            }
        }
    ]
})

const darksky = new DarkSky(darkskyConfig.key);

var getForecast = function () {
    darksky.forecast(darkskyConfig.latitude, darkskyConfig.longitude, {
        exclude: ['minutely', 'hourly', 'alerts', 'flags'],
        units: darkskyConfig.units
    }, function (err, responseBody) {
        if (err) {
            console.error('Error while requesting darksky forecast', err)
        }
        else {
            if (generalConfig.debug) {
                console.log(responseBody)
            }

            var forecast = JSON.parse(responseBody)
            var current = forecast.currently;
            var daily = forecast.daily.data[0];
            var moment = (new Date()).getTime() / 1000;
            var sunStatus = 0;

            if (generalConfig.debug) {
                console.log("Sunrise: ", daily.sunriseTime);
                console.log("Sunset: ", daily.sunsetTime);
                console.log("Now: ", moment);
            }

            if(moment > daily.sunriseTime && moment < daily.sunsetTime)
                sunStatus = 1;

            if (generalConfig.debug)
                console.log("Sun Status: ", sunStatus);

            const points = [
                {
                    measurement: 'weather',
                    fields: {
                        temperature: current.temperature,
                        apparent_temperature: current.apparentTemperature,
                        dew_point: current.dewPoint,
                        humidity: current.humidity,
                        wind_speed: current.windSpeed,
                        wind_bearing: current.windBearing,
                        cloud_cover: current.cloudCover,
                        pressure: current.pressure,
                        ozone: current.ozone,
                        uv_index: current.uvIndex,
                        visibility: current.visibility,
                        precip_intensity: current.precipIntensity,
                        precip_probability: current.precipProbability,
                        nearest_storm_distance: current.nearestStormDistance,
                        nearest_storm_bearing: current.nearestStormBearing,

                        sunrise_time: daily.sunriseTime,
                        sunset_time: daily.sunsetTime,
                        sun_status: sunStatus,
                    },
                    tags: {
                        source: 'darksky'
                    }
                },
                {
                    measurement: 'forecast',
                    fields: {
                        temperature_high: daily.temperatureHigh,
                        apparent_temperature_high: daily.apparentTemperatureHigh,
                        temperature_low: daily.temperatureLow,
                        apparent_temperature_low: daily.apparentTemperatureLow,
                        temperature_max: daily.temperatureMax,
                        apparent_temperature_max: daily.apparentTemperatureMax,
                        temperature_min: daily.temperatureMin,
                        apparent_temperature_min: daily.apparentTemperatureMin,
                        dew_point: daily.dewPoint,
                        humidity: daily.humidity,
                        wind_speed: daily.windSpeed,
                        wind_bearing: daily.windBearing,
                        cloud_cover: daily.cloudCover,
                        pressure: daily.pressure,
                        ozone: daily.ozone,
                        uv_index: daily.uvIndex,
                        visibility: daily.visibility,
                        precip_intensity: daily.precipIntensity,
                        precip_probability: daily.precipProbability,
                        sun_status: sunStatus,
                    },
                    tags: {
                        source: 'darksky'
                    }
                }
            ];

            influx.writePoints(points).catch(err => {
                console.error('Error writing to InfluxDB', err)
            })
        }
    })
}

if (generalConfig.cron) {
    cron.schedule(generalConfig.cron, function(){
        getForecast();
    });    

    console.log(`DarkSky data will be written to InfluxDB on cron interval '${generalConfig.cron}'`);
} else {
    getForecast();

    console.log('DarkSky data is written to InfluxDB');
}
