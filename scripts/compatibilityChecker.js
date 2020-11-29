export const compatibilityChecker = () => {

    // List to be updated manually as new modules release
    const incompatibleModules = [
        "betterrolls5e",
        "midi=qol",
    ];

    let activeModules = [];
    game.modules.forEach(m => {
        if (m.active) {
            activeModules.push(m.id);
        };
    });

    return !activeModules.some(m => incompatibleModules.includes(m));
};