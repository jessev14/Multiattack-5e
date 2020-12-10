async function setDefault() {
    const res = getChar();
    const character = res[0];
    const cName = res[1];
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
    await character.unsetFlag("multiattack-5e", "toolData");
    await character.setFlag("multiattack-5e", "toolData", selectedWeapons);

    ui.notifications.info(`Default set for ${cName}.`);
}

async function clearDefault() {
    const res = getChar();
    const character = res[0];
    const cName = res[1];
    const weaponsObject = document.getElementsByName("weapons");
    weaponsObject.forEach(w => {
        w.checked = false;
        document.getElementById(`${w.id}input`).value = "";
    });

    await character.setFlag("multiattack-5e", "defaultTool", false);
    await character.unsetFlag("multiattack-5e", "toolData");

    ui.notifications.info(`Default cleared for ${cName}.`);
}

function getChar() {
    let character;
    let cName;
    if (game.user.isGM) {
        if (canvas.tokens.controlled.length > 1 || canvas.tokens.controlled.length < 1) {
            ui.notifications.warn("Select a single token.");
            return null;
        } else {
            character = canvas.tokens.controlled[0].actor;
            cName = canvas.tokens.controlled[0].name;
        }
    } else {
        character = game.user.character;
        cName = character.name;
    }
    return [character, cName];
}

document.getElementById("setDefaultButton").onclick = setDefault;
document.getElementById("clearDefaultButton").onclick = clearDefault;