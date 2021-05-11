import MA5e from "./MA5e.js";

Hooks.once("init", () => {
    console.log("Multiattack 5e | Initializing");

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
        hint: "",
        scope: "world",
        config: false,
        type: String,
        //default: false
    });

});

Hooks.once("setup", () => {
    game.MA5e = new MA5e();
    game.MA5e.corePatching();
    if (game.settings.get("multiattack-5e", "enableTool")) game.MA5e.multiattackToolInit();
});

Hooks.once("ready", () => {

});