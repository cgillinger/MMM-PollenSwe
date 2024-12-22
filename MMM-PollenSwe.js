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
        language: config.language || "en",
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

    // Define required translations
    getTranslations: function() {
        return {
            en: "translations/en.json",
            sv: "translations/sv.json"
        };
    },

    // Define header for module
    getHeader: function() {
        return this.config.region + " - " + this.translate("POLLEN_FORECAST");
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.loaded = false;
        this.pollenData = {};
        
        // Set language from config
        this.config.language = config.language || this.config.language || "en";
        
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
            this.translate("TEST_MODE") : 
            this.translate("ATTRIBUTION");
        
        if (this.loading) {
            wrapper.innerHTML = this.translate("LOADING");
            return wrapper;
        }

        if (!this.loaded) {
            wrapper.innerHTML = this.translate("NO_DATA");
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
                    icon.src = "modules/" + this.name + "/icons/pollen-flower.svg";
                    icon.className = "pollen-icon " + this.getLevelClass(level.level);
                    iconCell.appendChild(icon);
                    row.appendChild(iconCell);
                }

                // Pollen type cell
                const typeCell = document.createElement("td");
                typeCell.className = "align-left";
                const pollenTypes = this.translate("POLLEN_TYPES");
                const translatedType = pollenTypes[level.pollenType] || level.pollenType;
                typeCell.innerHTML = translatedType;
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
        const translations = {
            0: "LEVEL_NONE",
            1: "LEVEL_LOW",
            2: "LEVEL_MEDIUM",
            3: "LEVEL_HIGH",
            4: "LEVEL_VERY_HIGH"
        };
        return this.translate(translations[level] || "UNKNOWN");
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