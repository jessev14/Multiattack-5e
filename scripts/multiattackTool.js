import { getCompatibility } from "./moduleCompatibility.js";
import { blankRoll } from "./override.js";

export function initMultiattackTool() {
    Hooks.on("getSceneControlButtons", (controls) => {
        const bar = controls.find(c => c.name === "token");
        bar.tools.push({
            name: "MA5e tool",
            title: "Multiattack",
            icon: "fas fa-dice-d20",
            onClick: () => multiattackTool(),
            button: true
        });
    });
}


async function multiattackTool() {
    const moduleCompatibility = getCompatibility();
    let character;
    let cName;
    if (game.user.isGM) {
        if (canvas.tokens.controlled.length !== 1) {
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



    const dialogTemplate = "modules/multiattack-5e/templates/MA5e-multi-item-dialog.html";
    let weapons = character.items.filter(i => i.hasAttack && i.data.type === "weapon");

    if (character.getFlag("multiattack-5e", "defaultTool")) {
        const flagItems = character.getFlag("multiattack-5e", "toolData");
        for (let i = 0; i < weapons.length; i++) {
            const selected = flagItems.find(f => f.id === weapons[i].id);
            if (selected) {
                await weapons[i].setFlag("multiattack-5e", "check", true);
                await weapons[i].setFlag("multiattack-5e", "count", selected.count);
            } else {
                await weapons[i].setFlag("multiattack-5e", "check", false);
                await weapons[i].unsetFlag("multiattack-5e", "count");
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
        width: 250,
        left: 120,
        top: 200
    }
    const buttons = {
        rollMA: {
            label: "Multiattack",
            callback: async (html) => rollMA(html)
        }
    };
    if (moduleCompatibility.core) {
        buttons.rollDamage = {
            label: "Damage",
            callback: async (html) => rollMADamage(html)
        };
    }

    new Dialog({
        title: `Multiattack - ${cName}`,
        content: dialogContent,
        buttons: buttons,
        default: "rollMA"
    }, dialogOptions).render(true);


    async function rollMA(html) {
        if (moduleCompatibility.midi) return midiMA5e(html);
        if (moduleCompatibility.betterrolls) return betterRollsMA5e(html);

        const rollsArray = await rollSelectedWeapons(html, "attack");
        if (!rollsArray.length) return null;
        const attackTemplate = "modules/multiattack-5e/templates/MA5e-multi-item-attack-chat.html";
        const chatContent = await renderTemplate(attackTemplate, { outerRolls: rollsArray });
        const messageData = {
            user: game.user._ud,
            type: 5,
            sound: CONFIG.sounds.dice,
            content: chatContent,
            roll: blankRoll,
            flavor: "",
            speaker: rollsArray[0].rolls[0].messageData.speaker,
            flags: rollsArray[0].rolls[0].messageData.flags
        };
        messageData["flags.multiattack-5e.multiItemAttack"] = true;

        // Render DSN if enabled in settings
        const setting = game.settings.get("multiattack-5e", "toolDSN");
        if (game.dice3d && (setting === "enabled" || setting === "attackOnly")) renderDSN(rollsArray);

        ChatMessage.create(messageData);
    }

    async function rollMADamage(html) {

        const rollsArray = await rollSelectedWeapons(html, "damage");
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
            sound: CONFIG.sounds.dice,
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
        if (game.dice3d && (setting === "enabled" || setting === "damageOnly")) renderDSN(rollsArray);

        ChatMessage.create(messageData);
    }

    async function rollSelectedWeapons(html, rollType = null) {
        const weaponsObject = html.find("[name=weapons]");
        const selectedWeapons = [];
        for (let i = 0; i < weaponsObject.length; i++) {
            const w = weaponsObject[i];
            if (w.checked) {
                selectedWeapons.push({
                    id: w.id,
                    count: html.find(`#${w.id}input`)[0].value > 0 ? html.find(`#${w.id}input`)[0].value : 1
                });
            }
        }

        if (rollType === null) return selectedWeapons;

        const options = {
            fastForward: true,
            chatMessage: false
        };
        const outerRollArray = [];
        for (let w of selectedWeapons) {
            const item = character.items.find(i => i.id === w.id);
            const innerRollArray = [];
            for (let i = 0; i < w.count; i++) {
                if (rollType === "attack") {
                    innerRollArray.push(await item.rollAttack(options));
                } else if (rollType === "damage") {
                    innerRollArray.push(await item.rollDamage({ event: {}, options: options }));
                }
            }
            outerRollArray.push({
                flavor: innerRollArray[0].messageData.flavor,
                formula: innerRollArray[0].formula,
                rolls: innerRollArray
            });
        }

        return outerRollArray;
    }

    async function renderDSN(rollsArray) {
        {
            for (let i = 0; i < rollsArray.length; i++) {
                for (let j = 0; j < rollsArray[i].rolls.length; j++)
                    if (j === rollsArray[i].rolls.length - 1 && i === rollsArray.length - 1) {
                        await game.dice3d.showForRoll(rollsArray[i].rolls[j]);
                    } else {
                        game.dice3d.showForRoll(rollsArray[i].rolls[j]);
                    }
            }
        }
    }

    async function betterRollsMA5e(html) {
        const selectedWeapons = await rollSelectedWeapons(html);
        if (!game.settings.get("multiattack-5e", "betterrollsDSN")) {
            let count = game.messages.entities.length;
            selectedWeapons.forEach(w => {
                for (let i = 0; i < w.count; i++) {
                    count++;
                }
            })
            const rollStartHook = Hooks.on("diceSoNiceRollStart", (messageID, context) => {
                context.blind = true;
            });
            const rollCompleteHook = Hooks.on("diceSoNiceRollComplete", () => {
                if (game.messages.entities.length >= count) {
                    Hooks.off("diceSoNiceRollStart", rollStartHook);
                    Hooks.off("diceSoNiceRollComplete", rollCompleteHook);
                }
            });
        }
        selectedWeapons.forEach(async (w) => {
            const item = character.items.find(i => i.id === w.id);
            for (let i = 0; i < w.count; i++) {
                BetterRolls.quickRollById(character.id, item.id);
            }
        });
    }

    async function midiMA5e(html) {
        if (game.dice3d) {
            await game.settings.set("dice-so-nice", "enabled", false);
        }
        const selectedWeapons = await rollSelectedWeapons(html);
        let count = 0;
        let endCount = 0;
        const selectedWeaponsArray = [];
        selectedWeapons.forEach(w => {
            for (let i = 0; i < w.count; i++) {
                endCount++;
                selectedWeaponsArray.push(
                    character.items.get(w.id)
                );
            }
        });
        const rollCompleteHook = Hooks.on('midi-qol.RollComplete', async () => {
            if (count === endCount - 1) {
                if (game.dice3d) {
                    await game.settings.set("dice-so-nice", "enabled", true);
                }
                return Hooks.off('midi-qol.RollComplete', rollCompleteHook);
            }
            count++
            selectedWeaponsArray[count].roll();
        });
        selectedWeaponsArray[0].roll();
    }
}