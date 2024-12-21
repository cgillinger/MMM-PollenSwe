const NodeHelper = require("node_helper");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_POLLEN_DATA") {
            this.getPollenData(payload.regionId);
        }
    },

    getPollenData: async function(regionId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const url = `https://api.pollenrapporten.se/v1/forecasts?region_id=${regionId}&start_date=${today}&current=true`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            let processedData = this.processPollenData(data);
            this.sendSocketNotification("POLLEN_DATA", processedData);
            
        } catch (error) {
            console.error("Error fetching pollen data:", error);
            this.sendSocketNotification("POLLEN_DATA", { levels: [] });
        }
    },

    processPollenData: function(data) {
        let processedData = { levels: [] };

        try {
            if (data?.data?.[0]?.info?.[0]?.levelSeries) {
                const today = new Date().toISOString().split('T')[0];
                
                processedData.levels = data.data[0].info[0].levelSeries
                    .filter(series => series.date === today)
                    .map(series => ({
                        pollenType: series.pollenType,
                        level: series.level,
                        date: series.date
                    }))
                    .sort((a, b) => b.level - a.level);
            }
            
            return processedData;
            
        } catch (error) {
            console.error("Error processing pollen data:", error);
            return { levels: [] };
        }
    }
});
