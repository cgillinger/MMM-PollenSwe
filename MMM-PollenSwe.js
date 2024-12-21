/* Magic Mirror
 * Module: MMM-PollenSwe
 * 
 * By Christian Gillinger
 * MIT Licensed.
 * 
 * Data provided by Swedish Museum of Natural History's Pollen API
 * https://api.pollenrapporten.se/docs
 */

Module.register("MMM-PollenSwe", {
    defaults: {
        updateInterval: 3600000, // Update every hour
        region: "Stockholm", // Default region
        regionId: "00000000-0000-4000-8000-000049960326", // Stockholm region ID
        initialLoadDelay: 0, // No delay for first check
        retryDelay: 2500, // Retry 2.5 seconds later if API fetch fails
        showIcon: true,
        showRegion: true,
        animationSpeed: 1000,
        maxPollensShown: 5, // Maximum number of pollen types to show
        autoHide: false, // Auto-hide module if no data
        autoHideDelay: 15, // Minutes to wait before hiding if no data
        testMode: false, // Enable test mode
        testData: { // Sample data for test mode
            levels: [
                { pollenType: "Birch", level: 4, date: "2024-12-21" },
                { pollenType: "Grass", level: 3, date: "2024-12-21" },
                { pollenType: "Mugwort", level: 2, date: "2024-12-21" },
                { pollenType: "Alder", level: 1, date: "2024-12-21" },
                { pollenType: "Hazel", level: 0, date: "2024-12-21" }
            ]
        },
        // Available regions and their IDs
        regions: {
            "Stockholm": "00000000-0000-4000-8000-000049960326",
            "Göteborg": "00000000-0000-4000-8000-00004996037e",
            "Malmö": "00000000-0000-4000-8000-0000499602e7",
            "Luleå": "00000000-0000-4000-8000-000049960344",
            "Kiruna": "00000000-0000-4000-8000-000049960341"
        }
    },

    // Required scripts
    getScripts: function() {
        return ["moment.js"];
    },

    // Define required styles
    getStyles: function() {
        return ["MMM-PollenSwe.css"];
    },

    // Define header for module
    getHeader: function() {
        return this.data.header || "Pollen Forecast";
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.loaded = false;
        this.pollenData = {};
        
        // If test mode is enabled, load test data immediately
        if (this.config.testMode) {
            Log.info("Test mode enabled for " + this.name);
            this.loaded = true;
            this.pollenData = this.config.testData;
            this.updateDom(this.config.animationSpeed);
        } else {
            this.scheduleUpdate(this.config.initialLoadDelay);
        }
        
        this.updateTimer = null;
        this.lastUpdateTime = null;
        this.hidden = false;
        this.autoHideTimer = null;
    },

    // Override dom generator
    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "pollen-wrapper";

        // Add attribution
        const attribution = document.createElement("div");
        attribution.className = "xsmall dimmed attribution";
        attribution.innerHTML = this.config.testMode ? 
            "Test Mode - Sample Data" : 
            "Data: Swedish Museum of Natural History";
        
        if (this.loading) {
            wrapper.innerHTML = "Loading pollen data...";
            return wrapper;
        }

        if (!this.loaded) {
            wrapper.innerHTML = "No pollen data from Pollenrapporten available";
            wrapper.appendChild(attribution);
            
            // Handle auto-hide if enabled
            if (this.config.autoHide && !this.hidden) {
                const self = this;
                clearTimeout(this.autoHideTimer);
                this.autoHideTimer = setTimeout(function() {
                    self.hide(1000, function() {
                        self.hidden = true;
                    });
                }, this.config.autoHideDelay * 60 * 1000);
            }
            return wrapper;
        }

        // Show region if enabled
        if (this.config.showRegion) {
            const region = document.createElement("div");
            region.className = "region bright";
            region.innerHTML = this.config.region;
            wrapper.appendChild(region);
        }

        // Create pollen list
        if (this.pollenData.levels) {
            const table = document.createElement("table");
            table.className = "small";

            this.pollenData.levels.slice(0, this.config.maxPollensShown).forEach(level => {
                const row = document.createElement("tr");
                
                // Icon cell
                if (this.config.showIcon) {
                    const iconCell = document.createElement("td");
                    iconCell.className = "icon";
                    const icon = document.createElement("img");
                    icon.src = "modules/" + this.name + "/icons/pollen-dust-svgrepo-com.svg";
                    icon.className = "pollen-icon " + this.getLevelClass(level.level);
                    iconCell.appendChild(icon);
                    row.appendChild(iconCell);
                }

                // Pollen type cell
                const typeCell = document.createElement("td");
                typeCell.className = "align-left";
                typeCell.innerHTML = level.pollenType;
                row.appendChild(typeCell);

                // Level cell
                const levelCell = document.createElement("td");
                levelCell.className = "align-right " + this.getLevelClass(level.level);
                levelCell.innerHTML = this.translateLevel(level.level);
                row.appendChild(levelCell);

                table.appendChild(row);
            });

            wrapper.appendChild(table);
        }

        wrapper.appendChild(attribution);
        return wrapper;
    },

    // Helper function to translate level numbers to text
    translateLevel: function(level) {
        const levels = {
            0: "None",
            1: "Low",
            2: "Medium",
            3: "High",
            4: "Very High"
        };
        return levels[level] || "Unknown";
    },

    // Helper function to get CSS class based on level
    getLevelClass: function(level) {
        const classes = {
            0: "level-none",
            1: "level-low",
            2: "level-medium",
            3: "level-high",
            4: "level-veryhigh"
        };
        return classes[level] || "";
    },

    // Update pollen data
    updatePollenData: function() {
        if (this.config.testMode) {
            Log.info("Test mode: Skipping API update");
            return;
        }
        
        this.loading = true;
        this.sendSocketNotification("GET_POLLEN_DATA", {
            regionId: this.config.regions[this.config.region] || this.config.regionId
        });
    },

    // Schedule next update
    scheduleUpdate: function(delay) {
        const self = this;
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(function() {
            self.updatePollenData();
        }, delay);
    },

    // Socket notification received
    socketNotificationReceived: function(notification, payload) {
        if (notification === "POLLEN_DATA") {
            this.loading = false;
            this.loaded = true;
            this.pollenData = payload;
            this.lastUpdateTime = moment();
            
            // If we have data and module was hidden, show it again
            if (this.hidden && this.pollenData.levels && this.pollenData.levels.length > 0) {
                this.show(1000, function() {
                    this.hidden = false;
                });
                clearTimeout(this.autoHideTimer);
            }
            
            this.updateDom(this.config.animationSpeed);
            this.scheduleUpdate(this.config.updateInterval);
        }
    }
});
