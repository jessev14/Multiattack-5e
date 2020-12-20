console.log("MA5e | multiattack-5e.js Loaded");

import { settingsInit } from "./settings.js";
import { getCompatibility } from "./moduleCompatibility.js";
import { coreRollerPatch } from "./override.js";
import { initMultiattackTool } from "./multiattackTool.js";

Hooks.once("init", () => {
    const moduleCompatibility = getCompatibility();
    
    // Initialize settings
    settingsInit();

    // If not using BR or Midi, override item attack/damage rolling + templates
    if (moduleCompatibility.core) {
        console.log("MA5e | Patching core roller");
        coreRollerPatch();
    }

    // Add Multiattack Tool button to token layer toolbar
    if (!game.settings.get("multiattack-5e", "disableTool")) {
        console.log("MA5e | Adding Multiattack tool")
        initMultiattackTool();     
    }
});