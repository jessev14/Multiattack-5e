import { libWrapper } from "../lib/shim.js";

const moduleName = "multiattack-5e";


Hooks.once("init", () => {
    if (game.modules.get("mre-dnd5e")?.active) return;

    libWrapper.register(moduleName, "CONFIG.Item.documentClass.prototype.rollDamage", function (wrapped, rollConfig) {
        if (!rollConfig.options) rollConfig.options = { messageData: {} };
        rollConfig.options.messageData = { speaker: ChatMessage.getSpeaker({ actor: this.actor }) };
        return wrapped(rollConfig);
    }, "WRAPPER");
});