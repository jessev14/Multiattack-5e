import { getCompatibility } from "./moduleCompatibility.js";

export function settingsInit() {
    const moduleCompatibility = getCompatibility();
    
    game.settings.register("multiattack-5e", "disableTool", {
        name: "Disable Multiattack Tool in Token toolbar",
        hint: "",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => window.location.reload()
    });

    if (moduleCompatibility.core) {
        game.settings.register("multiattack-5e", "customRollerDSN", {
            name: "Enable Dice So Nice! rendering for custom MA5e roller",
            hint: "Will not affect single attack/damage rolls",
            scope: "world",
            config: true,
            default: "enabled",
            type: String,
            choices: {
                disabled: "Disabled",
                attackOnly: "Attack rolls only",
                damageOnly: "Damage rolls only",
                enabled: "Enabled"
            }
        });

        game.settings.register("multiattack-5e", "toolDSN", {
            name: "Enable Dice So Nice! rendering for Multiattack tool",
            hint: "",
            scope: "world",
            config: true,
            default: "disabled",
            type: String,
            choices: {
                disabled: "Disabled",
                attackOnly: "Attack rolls only",
                damageOnly: "Damage rolls only",
                enabled: "Enabled"
            }
        }); 
    }

    if (moduleCompatibility.betterrolls && !game.settings.get("multiattack-5e", "disableTool")) {
        game.settings.register("multiattack-5e", "betterrollsDSN", {
            name: "Enable DSN for rolls made with Multiattack tool",
            hint: "Does not affect other rolls.",
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
        });
    }
}