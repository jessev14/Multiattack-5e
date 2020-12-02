export function settingsInit() {

    game.settings.register("multiattack-5e", "customRoller", {
        name: "Enable custom MA5e Attack/Damage rolling",
        hint: "Enable custom roll dialog box and custom multiattack chat cards. NOT COMPATIBLE with Better Rolls or Midi-QOL!",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
        onChange: () => window.location.reload()
    });

    game.settings.register("multiattack-5e", "disableTool", {
        name: "Disable Multiattack Tool in Token toolbar",
        hint: "",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => window.location.reload()
    });

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
