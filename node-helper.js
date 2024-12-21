const NodeHelper = require("node_helper");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },

    // Handle socket notifications from the module
    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_POLLEN_DATA") {
            this.getPollenData(payload.regionId);
        }
    },

    // Fetch pollen data from the Swedish Museum of Natural History API
    getPollenData: async function(regionId) {
        try {
            // Get current date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];
            
            // Construct API URL with current date and region
            const url = `https://api.pollenrapporten.se/v1/forecasts?region_id=${regionId}&start_date=${today}&current=true`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Process the data
            let processedData = this.processPollenData(data);
            
            // Send the processed data back to the module
            this.sendSocketNotification("POLLEN_DATA", processedData);
            
        } catch (error) {
            console.error("Error fetching pollen data:", error);
            // Send empty data structure to handle error gracefully in the module
            this.sendSocketNotification("POLLEN_DATA", { levels: [] });
        }
    },

    // Process the API response into a format suitable for display
    processPollenData: function(data) {
        let processedData = {
            levels: []
        };

        try {
            // Check if we have any forecasts
            if (data && data.data && data.data.length > 0) {
                const forecast = data.data[0]; // Get the most recent forecast
                
                // Process each pollen level in the forecast
                if (forecast.info && forecast.info.length > 0) {
                    const info = forecast.info[0]; // Get first info object (Swedish)
                    
                    // Map the data to a simpler format
                    if (info.levelSeries) {
                        const today = new Date().toISOString().split('T')[0];
                        
                        // Filter for today's data and create level objects
                        info.levelSeries
                            .filter(series => series.date === today)
                            .forEach(series => {
                                processedData.levels.push({
                                    pollenType: series.pollenType,
                                    level: series.level,
                                    date: series.date
                                });
                            });
                        
                        // Sort by level (highest first)
                        processedData.levels.sort((a, b) => b.level - a.level);
                    }
                }
            }
            
            return processedData;
            
        } catch (error) {
            console.error("Error processing pollen data:", error);
            return { levels: [] };
        }
    }
});
