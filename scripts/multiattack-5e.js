console.log("MA5e | multiattack-5e.js Loaded");

import { addChatMessageContextOptions } from '/systems/dnd5e/module/chat.js';
import { coreRollerPatch, addChatMessageContextOptionsMA5e } from '/modules/multiattack-5e/scripts/patches.js';
import { compatibilityChecker } from '/modules/multiattack-5e/scripts/compatibilityChecker.js'

/* -------------------------------------------- */

Hooks.once('init', () => {
    console.log("MA5e | 'init' hook firing");
    /*
    * If using core roller, replace default roll dialog template with MA5e and override Item5e attack and damage roll functions
    * (functions that are called when Attack/Damage chat card buttons are clicked)
    */
    if (compatibilityChecker()) {
        console.log("MA5e | No incompatible modules active; Patching core roller.");
        coreRollerPatch();
    };

    // Disable default "getChatLogEntryContext" and replace with custom function that can parse MA5e custom chat cards
    Hooks.off("getChatLogEntryContext", addChatMessageContextOptions);
    Hooks.on("getChatLogEntryContext", addChatMessageContextOptionsMA5e);

    // Initialize Multiattack Action toolbar button


});
