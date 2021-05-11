document.getElementById("setDefaultButton").onclick = setDefault;
document.getElementById("clearDefaultButton").onclick = clearDefault;

function setDefault() {
    if (canvas.tokens.controlled.length !== 1) return ui.notifications.warn("Select one token.")
    const token = canvas.tokens.controlled[0];

    const itemNameArray = game.MA5e.buildItemNameArray(document);
    token.actor.setFlag("multiattack-5e", "toolDefault", itemNameArray);
    ui.notifications.info(`${game.i18n.localize("multiattack-5e.ui.setDefault")} ${token.name}.`);
}

function clearDefault() {
    if (canvas.tokens.controlled.length !== 1) return ui.notifications.warn("Select one token.")
    const token = canvas.tokens.controlled[0]

    token.actor.unsetFlag("multiattack-5e", "toolDefault");
    const checkboxes = document.getElementsByClassName("dialog-checkbox");
    const inputs = document.getElementsByClassName("inputMA5e");
    for (let i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = false;
        inputs[i].value = null;
    }
    
    ui.notifications.warn(`${game.i18n.localize("multiattack-5e.ui.clearDefault")} ${token.name}`)
}