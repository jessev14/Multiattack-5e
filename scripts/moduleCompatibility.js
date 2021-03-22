export function getCompatibility() {
    let core = false;
    let betterrolls = false;
    let midi = false;

    // Manually updated list of modules that are incompatible with MA5e core patching
    const incompatibleModules = [
        "betterrolls5e",
        "midi-qol"
    ];
    const activeModules = [];
    game.modules.forEach(m => {
        if (incompatibleModules.includes(m.id) && m.active) {
            activeModules.push(m.id);
        }
    });

    if (!activeModules.length) {
        core = true;
    } else {
        if (activeModules.includes("betterrolls5e")) {
            betterrolls = true;
        }
        if (activeModules.includes("midi-qol")) {
            if (game.settings.get("midi-qol", "EnableWorkflow")) midi = true;
            else core = true;
        }
    }

    return {
        core: core,
        betterrolls: betterrolls,
        midi: midi
    }
}