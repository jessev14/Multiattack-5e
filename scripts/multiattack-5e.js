import MA5e from "./MA5e.js";

let core = true;

Hooks.once("init", () => {
    console.log("Multiattack 5e | Initializing");

    //update list as needed
    const incompatMods = ["midi-qol", "betterrolls5e", "mre-dnd5e"];
    for (let module of incompatMods) {
        if (game.modules.get(module)?.active) {
            core = false;
            break;
        }
    }

    // Register module settings
    game.settings.register("multiattack-5e", "enableTool", {
        name: game.i18n.localize("multiattack-5e.settings.disableTool.name"),
        hint: game.i18n.localize("multiattack-5e.settings.disableTool.hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => ui.controls.render(true)
    });

    game.settings.register("multiattack-5e", "playerTool", {
        name: game.i18n.localize("multiattack-5e.settings.playerTool.name"),
        hint: game.i18n.localize("multiattack-5e.settings.playerTool.hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("multiattack-5e", "extraAttackDSN", {
        name: game.i18n.localize("multiattack-5e.settings.extraAttackDSN.name"),
        hint: game.i18n.localize("multiattack-5e.settings.extraAttackDSN.hint"),
        scope: "world",
        config: game.modules.get("dice-so-nice")?.active && core,
        type: String,
        choices: {
            disabled: game.i18n.localize("multiattack-5e.settings.disabled"),
            attack: game.i18n.localize("multiattack-5e.settings.attackOnly"),
            damage: game.i18n.localize("multiattack-5e.settings.damageOnly"),
            enabled: game.i18n.localize("multiattack-5e.settings.enabled"),
        },
        default: "enabled",
    });

    game.settings.register("multiattack-5e", "multiattackDSN", {
        name: game.i18n.localize("multiattack-5e.settings.multiattackDSN.name"),
        hint: "",
        scope: "world",
        config: game.modules.get("dice-so-nice")?.active && core,
        type: String,
        choices: {
            disabled: game.i18n.localize("multiattack-5e.settings.disabled"),
            attack: game.i18n.localize("multiattack-5e.settings.attackOnly"),
            damage: game.i18n.localize("multiattack-5e.settings.damageOnly"),
            enabled: game.i18n.localize("multiattack-5e.settings.enabled"),
        },
        default: "disabled",
    });

    game.settings.register("multiattack-5e", "betterRollsDSN", {
        name: game.i18n.localize("multiattack-5e.settings.betterRollsDSN.name"),
        hint: "",
        scope: "world",
        config: game.modules.get("dice-so-nice")?.active && game.modules.get("betterrolls5e")?.active,
        type: Boolean,
        default: false
    });
});

Hooks.once("setup", () => {
    game.MA5e = new MA5e();

    if (core) game.MA5e.coreInit();
    if (game.settings.get("multiattack-5e", "enableTool")) game.MA5e.multiattackToolInit();
});
