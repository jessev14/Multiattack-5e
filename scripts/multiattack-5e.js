console.log("MA5e | multiattack-5e.js Loaded");

import { settingsInit } from '/modules/multiattack-5e/scripts/settings.js'
import { compatibilityChecker } from '/modules/multiattack-5e/scripts/compatibilityChecker.js'
import { coreRollerPatch, addChatMessageContextOptionsMA5e } from '/modules/multiattack-5e/scripts/patches.js';
import { addChatMessageContextOptions } from '/systems/dnd5e/module/chat.js';
import { multiattackTool } from '/modules/multiattack-5e/scripts/multiattackTool.js';

/* -------------------------------------------- */

Hooks.once('init', () => {
    console.log("MA5e | 'init' hook firing.");

    settingsInit();

    /*
    * If using core roller, replace default roll dialog template with MA5e and override Item5e attack and damage roll functions
    * (functions that are called when Attack/Damage chat card buttons are clicked)
    */
    if (compatibilityChecker() && game.settings.get("multiattack-5e", "customRoller")) {
        console.log("MA5e | Patching core roller.");
        coreRollerPatch();

        // Disable default "getChatLogEntryContext" and replace with custom function that can parse MA5e custom chat cards
        Hooks.off("getChatLogEntryContext", addChatMessageContextOptions);
        Hooks.on("getChatLogEntryContext", addChatMessageContextOptionsMA5e);
    };

    // Add Mulitattack Tool button to token layer toolbar
    if (!game.settings.get("multiattack-5e", "disableTool")) {
        Hooks.on("getSceneControlButtons", (controls) => {
            console.log("MA5e | 'getSceneControlButtons' hook firing.");
            const bar = controls.find(c => c.name === "token");
            bar.tools.push({
                name: "MA5e tool",
                title: "Multiattack",
                icon: "fas fa-dice-d20",
                onClick: () => multiattackTool(),
                button: true
            });
        });
    };


});

