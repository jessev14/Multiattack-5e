import { blankRoll } from "/modules/multiattack-5e/scripts/patches.js";

export async function multiattackTool() {

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

    const options = {
        fastForward: true,
        chatMessage: false
    };

    const dialogTemplate = "modules/multiattack-5e/templates/MA5e-multi-item-dialog.html";
    let weapons = character.items.filter(i => i.hasAttack && i.data.type === "weapon");

    if (character.getFlag("multiattack-5e", "defaultTool")) {
        const flagItems = character.getFlag("multiattack-5e", "toolData");
        for (let i = 0; i < weapons.length; i++) {
            const selected = flagItems.find(f => f.id === weapons[i].id);
            if (selected) {
                await weapons[i].setFlag("multiattack-5e", "check", true);
                await weapons[i].setFlag("multiattack-5e", "count", selected.count);
            }
        }
    } else {
        for (let i = 0; i < weapons.length; i++) {
            await weapons[i].setFlag("multiattack-5e", "check", false);
            await weapons[i].unsetFlag("multiattack-5e", "count");
        }
    }

    const dialogContent = await renderTemplate(dialogTemplate, { weapons: weapons, defaultCheck: character.getFlag("multiattack-5e", "defaultTool") });
    const dialogOptions = {
        id: "multiattack-tool-dialog",
        width: 250
    }

    new Dialog({
        title: `Multiattack - ${character.name}`,
        content: dialogContent,
        buttons: {
            rollMA: {
                label: "Multiattack",
                callback: async (html) => rollMA(html)
            },
            rollDamage: {
                label: "Damage",
                callback: async (html) => rollMADamage(html)
            }
        },
        default: "rollMA"
    }, dialogOptions).render(true);


    async function rollMA(html) {

        const rollsArray = await getSelectedWeapons(html, "attack");
        if (!rollsArray.length) return null;
        const attackTemplate = "modules/multiattack-5e/templates/MA5e-multi-item-attack-chat.html";
        const htmlContent = await renderTemplate(attackTemplate, { outerRolls: rollsArray })
        const messageData = {
            user: game.user._id,
            type: 5,
            // sound: CONFIG.sounds.dice,
            content: htmlContent,
            roll: blankRoll,
            flavor: "",
            speaker: rollsArray[0].rolls[0].messageData.speaker,
            flags: rollsArray[0].rolls[0].messageData.flags
        };
        messageData["flags.MA5e.multiItemAttack"] = true;

        // Render DSN if enabled in settings
        const setting = game.settings.get("multiattack-5e", "toolDSN");
        if (game.dice3d && (setting === "enabled" || setting === "attackOnly")) {
            for (let i = 0; i < rollsArray.length; i++) {
                for (let j = 0; j < rollsArray[i].rolls.length; j++)
                    if (j === rollsArray[i].rolls.length - 1 && i === rollsArray.length - 1) {
                        await game.dice3d.showForRoll(rollsArray[i].rolls[j]);
                    } else {
                        game.dice3d.showForRoll(rollsArray[i].rolls[j]);
                    }
            }
        }

        ChatMessage.create(messageData);

    }

    async function rollMADamage(html) {

        const rollsArray = await getSelectedWeapons(html, "damage");
        if (!rollsArray.length) return null;
        let totalDamage = 0;
        rollsArray.forEach(outer => {
            outer.rolls.forEach(inner => {
                totalDamage += inner.total;
            })
        });
        const damageTemplate = "modules/multiattack-5e/templates/MA5e-multi-item-damage-chat.html";
        const htmlContent = await renderTemplate(damageTemplate, { outerRolls: rollsArray, totalDamage: totalDamage })
        const messageData = {
            user: game.user._id,
            type: 5,
            // sound: CONFIG.sounds.dice,
            content: htmlContent,
            roll: blankRoll,
            flavor: "",
            speaker: rollsArray[0].rolls[0].messageData.speaker,
            flags: rollsArray[0].rolls[0].messageData.flags
        };
        messageData["flags.MA5e.multiItemAttack"] = false;
        messageData["flags.MA5e.damageRoll"] = true;
        messageData["flags.MA5e.totalDamage"] = totalDamage;

        // Render DSN if enabled in settings
        const setting = game.settings.get("multiattack-5e", "toolDSN");
        if (game.dice3d && (setting === "enabled" || setting === "damageOnly")) {
            for (let i = 0; i < rollsArray.length; i++) {
                for (let j = 0; j < rollsArray[i].rolls.length; j++)
                    if (j === rollsArray[i].rolls.length - 1 && i === rollsArray.length - 1) {
                        await game.dice3d.showForRoll(rollsArray[i].rolls[j]);
                    } else {
                        game.dice3d.showForRoll(rollsArray[i].rolls[j]);
                    }
            }
        }

        ChatMessage.create(messageData);
    }

    async function getSelectedWeapons(html, rollType = null) {
        const weaponsObject = html.find("[name=weapons]");
        let selectedWeapons = [];
        for (let i = 0; i < weaponsObject.length; i++) {
            const weap = weaponsObject[i];
            if (weap.checked) {
                selectedWeapons.push({
                    id: weap.id,
                    count: html.find(`#${weap.id}input`)[0].value > 0 ? html.find(`#${weap.id}input`)[0].value : 1
                });
            }
        }

        if (rollType) return buildRollsArray(selectedWeapons, rollType);
        return selectedWeapons;

        async function buildRollsArray(selectedWeapons, rollType) {
            let outerRollArray = await Promise.all(selectedWeapons.map(async (w) => {
                const item = character.items.find(i => i.id === w.id);
                let innerRollArray = [];
                for (let i = 0; i < w.count; i++) {
                    // BetterRolls.quickRollById(character.id, item.id); // use BR roller 
                    // Hooks.once("midi-qol.RollComplete", () => item.roll());
                    if (game.settings.get("multiattack-5e", "customRoller")) {
                        if (rollType === "attack") {
                            innerRollArray.push(await item.rollAttack(options));
                        } else if (rollType === "damage") {
                            innerRollArray.push(await item.rollDamage({ options: options }));
                        }
                    }
                }
                return {
                    flavor: innerRollArray[0].messageData.flavor,
                    formula: innerRollArray[0].formula,
                    rolls: innerRollArray
                };
            }));

            return outerRollArray;
        }

    }

}