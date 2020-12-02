async function setDefault() {
    let character;
    if (game.user.isGM) {
        if (canvas.tokens.controlled.length > 1 || canvas.tokens.controlled.length < 1) {
            ui.notifications.warn("Select a single token.");
            return null;
        } else {
            character = canvas.tokens.controlled[0].actor;
        }
    } else {
        character = game.user.character;
    }

    const weaponsObject = document.getElementsByName("weapons");
    let selectedWeapons = [];
    for (let i = 0; i < weaponsObject.length; i++) {
        const weap = weaponsObject[i];
        if (weap.checked) {
            selectedWeapons.push({
                id: weap.id,
                count: document.getElementById(`${weap.id}input`).value > 0 ? document.getElementById(`${weap.id}input`).value : 1
            });
        }
    }

    await character.setFlag("multiattack-5e", "defaultTool", true);
    await character.setFlag("multiattack-5e", "toolData", selectedWeapons);

    ui.notifications.info(`Default set for ${character.name}.`);
}

async function clearDefault() {
    let character;
    if (game.user.isGM) {
        if (canvas.tokens.controlled.length > 1 || canvas.tokens.controlled.length < 1) {
            ui.notifications.warn("Select a single token.");
            return null;
        } else {
            character = canvas.tokens.controlled[0].actor;
        }
    } else {
        character = game.user.character;
    }

    const weaponsObject = document.getElementsByName("weapons");
    weaponsObject.forEach(w => {
        w.checked = false;
        document.getElementById(`${w.id}input`).value = "";
    });

    await character.setFlag("multiattack-5e", "defaultTool", false);
    await character.unsetFlag("multiattack-5e", "toolData");

    ui.notifications.info(`Default cleared for ${character.name}.`);
}

document.getElementById("setDefaultButton").onclick = setDefault;
document.getElementById("clearDefaultButton").onclick = clearDefault;