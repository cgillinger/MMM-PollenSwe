const NodeHelper = require("node_helper");
const fetch = require("node-fetch");
const Log = require("logger");

module.exports = NodeHelper.create({
    start: function() {
        Log.info("Starting node helper for: " + this.name);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_POLLEN_DATA") {
            this.getPollenData(payload.forecastUrl);
        }
        else if (notification === "GET_REGIONS") {
            this.getRegions();
        }
    },

    getRegions: async function() {
        try {
            const url = "https://api.pollenrapporten.se/v1/regions";
            Log.info("Getting regions from:", url);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            this.sendSocketNotification("REGIONS_DATA", data.items);

        } catch (error) {
            Log.error("Error fetching regions:", error);
            this.sendSocketNotification("REGIONS_DATA", []);
        }
    },

    getPollenData: async function(forecastUrl) {
        try {
            Log.info("Getting pollen data from:", forecastUrl);

            const response = await fetch(forecastUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            Log.debug("Pollen data:", data);
            let processedData = this.processPollenData(data);
            Log.debug("Processed pollen data:", processedData);
            this.sendSocketNotification("POLLEN_DATA", processedData);

        } catch (error) {
            Log.error("Error fetching pollen data:", error);
            this.sendSocketNotification("POLLEN_DATA", { levels: [] });
        }
    },

    processPollenData: function(data) {
        let processedData = { levels: [] };

        try {
            if (data?.items?.[0]?.levelSeries) {

                data.items[0].levelSeries.map(entry => {
                    Log.debug("Entry", entry);
                    // {"pollenId":"2a2a2a2a-2a2a-4a2a-aa2a-2a313a323533","level":0,"time":"2025-03-20T00:00:00"}
                });

                const today = new Date().toISOString().split('T')[0];
                processedData.levels = data.items[0].levelSeries
                    .filter(series => series.time.split('T')[0] === today)
                    .map(series => ({
                        pollenId: series.pollenId,
                        level: series.level,
                        date: series.time
                    }))
                    .sort((a, b) => b.level - a.level);
            }
            return processedData;

        } catch (error) {
            Log.error("Error processing pollen data:", error);
            return { levels: [] };
        }
    }
});
