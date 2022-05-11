const moduleName = "multiattack-5e";
let roller = "core";
let MA5e;
let MREutils;// CustomRoll;


Hooks.once("init", async () => {
    // TO DO: figure out best practice for opening API 
    // Open module API
    game.MA5e = Multiattack5e;
    MA5e = game.MA5e;

    // Determine active roller modules
    if (game.modules.get("betterrolls5e")?.active) roller = "br";
    //if (roller === "br") CustomRoll = await import("/modules/betterrolls5e/scripts/custom-roll.js");
    if (game.modules.get("midi-qol")?.active && game.settings.get("midi-qol", "EnableWorkflow")) roller = "midi";
    if (game.modules.get("mre-dnd5e")?.active) {
        roller = "mre";
        MREutils = await import("/modules/mre-dnd5e/scripts/utils.mjs");
    }

    // Register module settings
    MA5e.registerSettings();
});

Hooks.once("setup", () => {
    MA5e.registerSetupHooks();
});

Hooks.once("ready", () => {
    if (roller === "core") MA5e.registerCoreReadyHooks();
    if (roller === "mre") MA5e.registerMREreadyHooks();
});


class Multiattack5e {
    // Settings
    static registerSettings() {
        game.settings.register(moduleName, "condenseCards", {
            name: "MA5e.settings.condenseCards.name",
            hint: "",
            scope: "world",
            config: roller === "core" || roller === "mre",
            type: Boolean,
            default: true
        });

        game.settings.register(moduleName, "enableTool", {
            name: "MA5e.settings.disableTool.name",
            hint: "MA5e.settings.disableTool.hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => ui.controls.render(true)
        });

        game.settings.register(moduleName, "playerTool", {
            name: "MA5e.settings.playerTool.name",
            hint: "MA5e.settings.playerTool.hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        });

        game.settings.register(moduleName, "extraAttackDSN", {
            name: "MA5e.settings.extraAttackDSN.name",
            hint: "MA5e.settings.extraAttackDSN.hint",
            scope: "world",
            config: game.modules.get("dice-so-nice")?.active && roller === "core",
            type: String,
            choices: {
                disabled: game.i18n.localize("MA5e.settings.disabled"),
                attack: game.i18n.localize("MA5e.settings.attackOnly"),
                damage: game.i18n.localize("MA5e.settings.damageOnly"),
                enabled: game.i18n.localize("MA5e.settings.enabled"),
            },
            default: "enabled",
        });

        game.settings.register(moduleName, "multiattackDSN", {
            name: "MA5e.settings.multiattackDSN.name",
            hint: "",
            scope: "world",
            config: game.modules.get("dice-so-nice")?.active && roller === "core",
            type: String,
            choices: {
                disabled: game.i18n.localize("MA5e.settings.disabled"),
                attack: game.i18n.localize("MA5e.settings.attackOnly"),
                damage: game.i18n.localize("MA5e.settings.damageOnly"),
                enabled: game.i18n.localize("MA5e.settings.enabled"),
            },
            default: "disabled",
        });

        game.settings.register(moduleName, "betterRollsDSN", {
            name: "MA5e.settings.betterRollsDSN.name",
            hint: "",
            scope: "world",
            config: game.modules.get("dice-so-nice")?.active && game.modules.get("betterrolls5e")?.active,
            type: Boolean,
            default: false
        });
    }

    // Setup Hooks
    static registerSetupHooks() {
        Hooks.on("getSceneControlButtons", controls => {
            const bar = controls.find(c => c.name === "token");
            bar.tools.push({
                name: "Multiattack Tool",
                title: game.i18n.localize("MA5e.tool.control.title"),
                icon: "fas fa-fist-raised",
                onClick: game.MA5e.multiattackToolDialog.bind(),
                button: true
            });
        });
    }

    // Ready hooks
    static registerCoreReadyHooks() {
        Hooks.on("renderDialog", async (dialog, html, dialogData) => {
            // Filter for Attack/Damage roll configuration dialog render
            const title = dialog.data.title;
            if (!(title.includes(game.i18n.localize("DND5E.AttackRoll")) || title.includes(game.i18n.localize("DND5E.DamageRoll")))) return;

            // Inject number-of-rolls select element
            const numberSelectElement = `
                <div class="form-group">
                    <label>${game.i18n.localize("MA5e.dialog.numberOfRolls")}</label>
                    <select name="number-of-rolls">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                    </select>
                </div>
            `;
            html.find(`form`).append(numberSelectElement);
            html.css("height", "auto");

            // Override dialog button callbacks
            for (const vantage of Object.keys(dialog.data.buttons)) {
                const ogCallback = dialog.data.buttons[vantage].callback;
                dialog.data.buttons[vantage].callback = html => {
                    const numberOfRolls = parseInt(html.find(`select[name="number-of-rolls"]`).val());
                    // If numberOfRolls === 1, proceed using default behavior
                    if (numberOfRolls !== 1) {
                        // Before making prime roll, prepare to intercept chat message creation and prevent it
                        Hooks.once("preCreateChatMessage", (chatMessage, chatMessageData, options, userID) => {
                            (async () => {
                                await new Promise(resolve => setTimeout(() => resolve(), 100)); // Short delay to allow prime roll to complete usage/ammo updates

                                // Gather roll, actor, and item information from chat message data
                                const primeRoll = chatMessage.roll;
                                const tokenID = chatMessage.data.speaker.token;
                                const actorID = chatMessage.data.speaker.actor;
                                const actor = canvas.tokens.get(tokenID)?.actor || game.actors.get(actorID);
                                const rollType = chatMessage.getFlag("dnd5e", "roll.type");
                                const itemID = chatMessage.getFlag("dnd5e", "roll.itemId");
                                const item = actor.items.get(itemID);
                                let rollOptions;
                                if (rollType === "attack") {
                                    rollOptions = {
                                        fastForward: true,
                                        chatMessage: false,
                                        advantage: vantage === "advantage",
                                        disadvantage: vantage === "disadvantage"
                                    };
                                } else {
                                    rollOptions = {
                                        critical: primeRoll.isCritical,
                                        options: {
                                            fastForward: true,
                                            chatMessage: false
                                        }
                                    };
                                }

                                const rollArray = [primeRoll];
                                for (let i = 1; i < numberOfRolls; i++) {
                                    const itemRoll = rollType === "attack"
                                        ? await item.rollAttack(rollOptions)
                                        : await item.rollDamage(rollOptions);
                                    if (!itemRoll) break;

                                    rollArray.push(itemRoll);
                                }
                                const dsnSetting = game.settings.get(moduleName, "extraAttackDSN");
                                if (game.settings.get(moduleName, "condenseCards")) {
                                    for (const roll of rollArray) {
                                        roll.tooltip = await roll.getTooltip();
                                        if (rollType === "attack") {
                                            roll.highlight = roll.dice[0].total >= roll.options.critical
                                                ? "critical"
                                                : roll.dice[0].total <= roll.options.fumble
                                                    ? "fumble"
                                                    : "";
                                        }
                                    }
                                    const pool = PoolTerm.fromRolls(rollArray);
                                    const roll = Roll.fromTerms([pool]);

                                    const templateData = {
                                        items: [{
                                            flavor: chatMessage.data.flavor,
                                            formula: rollArray[0].formula,
                                            rolls: rollArray
                                        }]
                                    };
                                    if (rollType === "damage") templateData.totalDamage = rollArray.reduce((acc, r) => acc += r.total, 0);
                                    const content = await renderTemplate(`modules/${moduleName}/templates/condensed-card.hbs`, templateData);

                                    if (game.dice3d && (dsnSetting === "disabled" || dsnSetting !== rollType) && dsnSetting !== "enabled") Hooks.once("diceSoNiceRollStart", (id, context) => { context.blind = true });

                                    await ChatMessage.create({
                                        speaker: chatMessage.data.speaker,
                                        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                                        content,
                                        roll,
                                        rollMode: primeRoll.options.rollMode,
                                        flags: chatMessage.data.flags
                                    });
                                } else {
                                    let hk;
                                    if (game.dice3d && (dsnSetting === "disabled" || dsnSetting !== rollType) && dsnSetting !== "enabled") hk = Hooks.on("diceSoNiceRollStart", (id, context) => { context.blind = true });

                                    for (const roll of rollArray) {
                                        await roll.toMessage({
                                            speaker: chatMessage.data.speaker,
                                            flags: chatMessage.data.flags
                                        });
                                    }

                                    if (hk) Hooks.off("diceSoNiceRollStart", hk);
                                }
                            })();

                            // Return false in preCreateChatMessage hook to prevent chat card from being created
                            return false;
                        });
                    }

                    // Call original callback function to initiate prime roll
                    const rollType = title.includes(game.i18n.localize("DND5E.AttackRoll")) ? "attack" : "damage";
                    let vantageMode;
                    if (rollType === "attack") vantageMode = CONFIG.Dice.D20Roll.ADV_MODE[vantage];
                    else vantageMode = vantage === "critical";
                    return ogCallback(html, vantageMode);
                }
            }
        });

    }

    static registerMREreadyHooks() {
        Hooks.on("renderDialog", async (dialog, html, dialogData) => {
            // Filter for Attack/Damage roll configuration dialog render
            const title = dialog.data.title;
            if (!(title.includes(game.i18n.localize("DND5E.AttackRoll")) || title.includes(game.i18n.localize("DND5E.DamageRoll")))) return;

            // Inject number-of-rolls select element
            const numberSelectElement = `
                <div class="form-group">
                    <label>${game.i18n.localize("MA5e.dialog.numberOfRolls")}</label>
                    <select name="number-of-rolls">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                    </select>
                </div>
            `;
            html.find(`form`).append(numberSelectElement);
            html.css("height", "auto");

            // Override dialog button callbacks
            for (const vantage of Object.keys(dialog.data.buttons)) {
                const ogCallback = dialog.data.buttons[vantage].callback;
                dialog.data.buttons[vantage].callback = html => {
                    const numberOfRolls = parseInt(html.find(`select[name="number-of-rolls"]`).val());
                    // If numberOfRolls === 1, proceed using default behavior
                    if (numberOfRolls !== 1) {
                        // Before making prime roll, prepare to intercept chat message creation and prevent it
                        Hooks.once("preCreateChatMessage", (chatMessage, chatMessageData, options, userID) => {
                            (async () => {
                                // Gather roll, actor, and item information from chat message data
                                const tokenID = chatMessage.data.speaker.token;
                                const actorID = chatMessage.data.speaker.actor;
                                const actor = canvas.tokens.get(tokenID)?.actor || game.actors.get(actorID);
                                const rollType = chatMessage.getFlag("dnd5e", "roll.type") || chatMessage.data.flags["dnd5e.roll"].type;
                                const itemID = chatMessage.getFlag("dnd5e", "roll.itemId") || chatMessage.data.flags["dnd5e.roll"].itemId;
                                // If rollType === "attack", gather ammo data
                                const item = actor.items.get(itemID);
                                let consume, ammo;
                                if (rollType === "attack") {
                                    consume = item.data.data.consume;
                                    if (consume?.type === "ammo") ammo = item.actor.items.get(consume.target);
                                }

                                if (rollType === "damage") {
                                    const originalSetting = game.settings.get("mre-dnd5e", "rollDialogBehaviorLocal");
                                    game.settings.set("mre-dnd5e", "rollDialogBehaviorLocal", "skip");
                                    const rolls = [...chatMessage.data.flags["mre-dnd5e.rolls"]];
                                    let damageTotal = chatMessage.data.flags["mre-dnd5e.rolls"].reduce((acc, r) => acc + r.total, 0);
                                    let combinedContent = chatMessage.data.content;
                                    for (let i = 1; i < numberOfRolls; i++) {
                                        Hooks.once("preCreateChatMessage", (chatMessage, chatMessageData, options, userID) => {
                                            combinedContent += chatMessage.data.content;
                                            const mreRolls = chatMessage.data.flags["mre-dnd5e.rolls"];
                                            rolls.push(...mreRolls);
                                            mreRolls.forEach(r => damageTotal += r.total);
                                            return false;
                                        });
                                        await item.rollDamage();
                                    }
                                    game.settings.set("mre-dnd5e", "rollDialogBehaviorLocal", originalSetting);
                                    const content = $(`<div>` + combinedContent + `</div>`);
                                    content.find(".card-total").remove();
                                    content.find(`div.card-roll.formula-group`).last().append(`<h4 class="card-total dice-total" data-damage-type="Total">${damageTotal}</h4>`);

                                    const chatData = duplicate(chatMessage.data);
                                    chatData.content = content.prop("outerHTML");
                                    chatData.roll = MREutils.combineRolls(...rolls)
                                    await ChatMessage.create(chatData);
                                    return;
                                }

                                // Use original roll as "prime" roll on which follow-up rolls will be based
                                const primeRoll = chatMessage.roll;
                                const rolls = [primeRoll];
                                for (let i = 0; i < numberOfRolls; i++) {
                                    // If applicable, ensure actor has enough ammo to commit to next attack roll
                                    if (ammo?.data && rollType === "attack") {
                                        const ammoQty = ammo.data.data.quantity;
                                        const consumeAmount = consume.amount ?? 0;
                                        if (consumeAmount > ammoQty) {
                                            ui.notifications.warn("Not enough ammo for remaining attacks!") // LOCALIZE; and specify lacking ammo
                                            break;
                                        }
                                    }

                                    // Using prime roll data, re-create rolls
                                    //if (i !== 0) rolls.push(await primeRoll.reroll()); // can't use .reroll() for damage rolls because crit damage gets doubled up
                                    const rollClass = rollType === "attack" ? CONFIG.Dice.D20Roll : CONFIG.Dice.DamageRoll;
                                    if (i !== 0) {
                                        const newRoll = await new rollClass(primeRoll.formula, primeRoll.data, rollType === "attack" ? primeRoll.options : {}).evaluate();
                                        rolls.push(newRoll);
                                        if (game.dice3d) game.dice3d.showForRoll(newRoll, game.user, true, null, game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.BLIND, null, chatMessage.data.speaker);
                                        if (game.dice3d && i === numberOfRolls - 1) await game.dice3d.showForRoll(newRoll, game.user, true, null, game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.BLIND, null, chatMessage.data.speaker);
                                    }

                                    // If applicable, update ammo quantity
                                    if (rollType === "atttack") continue;
                                    const usage = item._getUsageUpdates({ consumeResource: true });
                                    const ammoUpdate = usage.resourceUpdates || {};
                                    if (!isObjectEmpty(ammoUpdate)) await ammo?.update(ammoUpdate);
                                }

                                let rollSum = 0;
                                // Prepare individual roll information for custom template
                                for (const roll of rolls) {
                                    roll.tooltip = await roll.getTooltip();
                                    roll.highlight = roll.terms[0].total >= roll.options.critical ? "critical" : roll.terms[0].total === 1 ? "fumble" : "";
                                    rollSum += roll.total;
                                }
                                // Prepare chat card information relevant to the item roll is based on
                                const items = [{
                                    flavor: chatMessage.data.flavor,
                                    formula: rolls[0].formula,
                                    rolls
                                }];
                                // Convert the item information into a generic format compatible with the custom template
                                const templateData = {
                                    items
                                };

                                // Render custom chat card template and create chat message
                                const content = await renderTemplate(`modules/${moduleName}/templates/condensed-card.hbs`, templateData);
                                ChatMessage.create({
                                    content,
                                    speaker: chatMessage.data.speaker,
                                    flags: chatMessage.data.flags,
                                    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                                    roll: await new Roll(`${rollSum}`).evaluate(), // This allows the total damage to be applied to tokens via chat card context menu
                                    rollMode: game.settings.get("core", "rollMode")
                                });

                            })();

                            // Return false in preCreateChatMessage hook to prevent chat card from being created
                            return false;
                        });
                    }

                    // Call original callback function to initiate prime roll
                    ogCallback(html, CONFIG.Dice.D20Roll.ADV_MODE[vantage]);
                }
            }
        });
    }

    // Multiattack Dialog
    static async multiattackToolDialog() {
        const token = canvas.tokens.controlled[0];
        if (canvas.tokens.controlled.length !== 1) return ui.notifications.warn(game.i18n.localize("MA5e.ui.selectOneToken"));

        const weaponIDs = token.actor.items.contents
            .filter(i => i.type === "weapon" && i.hasAttack)
            .map(w => w.id);
        const weapons = [];
        weaponIDs.forEach(wID => {
            const item = token.actor.items.get(wID);
            const dataForTemplate = {
                name: item.name,
                id: item.id,
                img: item.img,
                checked: item.getFlag(moduleName, "checked"),
                count: item.getFlag(moduleName, "count")
            };
            weapons.push(dataForTemplate);
        });
        const templateData = {
            weapons: weapons
        };
        const content = await renderTemplate(`modules/${moduleName}/templates/multiattack-tool-dialog.hbs`, templateData);
        const buttonPosition = $(document).find(`li.control-tool[data-tool="Multiattack Tool"]`).offset();
        const dialogOptions = {
            id: "multiattack-tool-dialog",
            width: 250,
            top: buttonPosition.top,
            left: buttonPosition.left + 50,
            resizable: true
        };

        let rollType;
        new Dialog({
            title: "Multiattack",
            content,
            buttons: {
                attack: {
                    label: game.i18n.localize("DND5E.Attack"),
                    callback: () => rollType = "attack"
                },
                damage: {
                    label: game.i18n.localize("DND5E.Damage"),
                    callback: () => rollType = "damage"
                }
            },
            render: html => {
                // Apply default multiattack if found on token
                const defaultMultiattack = token.document.getFlag(moduleName, "defaultMultiattack");
                if (defaultMultiattack) {
                    for (const weaponID of defaultMultiattack) {
                        const option = html.find(`div#${weaponID}`);
                        const input = option.find(`input[type="number"]`);
                        input.val(input.val() ? parseInt(input.val()) + 1 : 1);
                        const check = option.find(`input[type="checkbox"]`);
                        check.prop("checked", true);

                    }
                }

                // Add onclick handlers for set/clear default buttons
                html.find("#setDefaultButton").click(setDefault);
                html.find("#clearDefaultButton").click(clearDefault);

                function setDefault() {
                    const itemIDarray = [];
                    const items = $(html).find("div.MA5e-multiattack");
                    items.each(function () {
                        if (!$(this).find(`input[type="checkbox"]`).prop("checked")) return;
                        const num = $(this).find(`input[type="number"]`).val() || 1;
                        for (let i = 0; i < num; i++) itemIDarray.push($(this).prop("id"));
                    });

                    token.document.setFlag(moduleName, "defaultMultiattack", itemIDarray);
                    ui.notifications.info(`${game.i18n.localize("MA5e.ui.setDefault")} ${token.name}.`);
                }

                function clearDefault() {
                    token.document.unsetFlag(moduleName, "defaultMultiattack");

                    const checkboxes = document.getElementsByClassName("dialog-checkbox");
                    const inputs = document.getElementsByClassName("inputMA5e");
                    for (let i = 0; i < checkboxes.length; i++) {
                        checkboxes[i].checked = false;
                        inputs[i].value = null;
                    }

                    ui.notifications.warn(`${game.i18n.localize("MA5e.ui.clearDefault")} ${token.name}`);
                }

            },
            close: async html => {
                if (!rollType) return;

                const itemIDarray = [];
                const items = html.find(`div.MA5e-multiattack`);
                items.each(function () {
                    if (!$(this).find(`input[type="checkbox"]`).prop("checked")) return;
                    const num = $(this).find(`input[type="number"]`).val() || 1;
                    for (let i = 0; i < num; i++) itemIDarray.push($(this).prop("id"));
                });

                await game.MA5e.multiattack({
                    actor: token.actor,
                    itemNameArray: itemIDarray.map(id => token.actor.items.get(id).name),
                    rollType
                });
            }
        }, dialogOptions).render(true);
    }

    // Utility
    static async multiattack({ actor, itemNameArray, rollType = "attack", rollMode = null }) {
        if (!actor) actor = canvas.tokens.controlled[0];
        if (!actor) return;
        if (!itemNameArray.length) return;
        if (roller === "core") {
            const items = [];
            let rollSum = 0;
            for (const itemName of itemNameArray) {
                const item = actor.items.getName(itemName);
                const sameItem = items.find(i => i.itemName === itemName);
                if (sameItem) { } // TO DO: if same item, re-add item._ammo to properly get new formula
                const options = { fastForward: true, chatMessage: false };
                const roll = rollType === "attack" ?
                    await item.rollAttack(options)
                    : await item.rollDamage({ options });
                if (!roll) continue;

                roll.tooltip = await roll.getTooltip();
                if (rollType === "attack") roll.highlight = roll.terms[0].total >= roll.options.critical ? "critical" : roll.terms[0].total <= roll.options.fumble ? "fumble" : "";
                rollSum += roll.total;

                if (sameItem) sameItem.rolls.push(roll);
                else {
                    items.push({
                        itemName,
                        flavor: roll.options.flavor,
                        formula: roll.formula,
                        rolls: [roll]
                    });
                }
            }

            rollMode = rollMode || game.settings.get("core", "rollMode");
            if (game.settings.get(moduleName, "condenseCards")) {
                const templateData = { items };
                if (rollType === "damage") templateData.totalDamage = rollSum;
                const content = await renderTemplate(`modules/${moduleName}/templates/condensed-card.hbs`, templateData);
                ChatMessage.create({
                    content,
                    speaker: ChatMessage.getSpeaker({ actor }),
                    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                    roll: await new Roll(`${rollSum}`).evaluate(),
                    rollMode
                });
            } else {
                for (const item of items) {
                    for (const roll of item.rolls) {
                        await roll.toMessage({
                            rollMode
                        });
                    }
                }
            }

            return items;
        } else if (roller === "midi") {
            const items = itemNameArray.map(name => actor.items.getName(name));
            let hk;
            if (game.dice3d) hk = Hooks.on("diceSoNiceRollStart", midiMA5eDSNHide);
            Hooks.on("diceSoNiceRollStart", midiMA5eDSNHide);
            let i = 0;
            Hooks.once("midi-qol.RollComplete", nextMidiRoll);
            await items[i].roll();


            function midiMA5eDSNHide(messageID, context) {
                context.blind = true;
            }

            function nextMidiRoll() {
                (async () => {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    i += 1;
                    if (i >= items.length) {
                        if (hk) Hooks.off("diceSoNiceRollStart", hk);
                        return;
                    }

                    Hooks.once("midi-qol.RollComplete", nextMidiRoll);
                    await items[i].roll();
                })();
            }
        } else if (roller === "br") {
            // Hide DSN based on module setting
            let hk;
            if (!game.settings.get(moduleName, "betterRollsDSN")) hk = Hooks.on("diceSoNiceRollStart", (messageID, context) => { context.blind = true });

            // Use BR to perform rolls and collect resulting chat message data (do not actually create these chat messages)
            //const chatMessageDataArray = []
            for (let i = 0; i < itemNameArray.length; i++) {
                const item = actor.items.getName(itemNameArray[i]);
                //const BRroll = new CustomRoll.CustomItemRoll(item);
                const BRroll = BetterRolls.rollItem(item);
                await BRroll.toMessage();
                //const chatMessageData = await BRroll.toMessage({ createMessage: false });
                //if (chatMessageData) chatMessageDataArray.push(chatMessageData);
            }
            if (hk) Hooks.off("diceSoNiceRollStart", hk);

            /* 
            // Combine chat message content into single card
            let combinedMessageContent = ``;
            chatMessageDataArray.forEach(c => { combinedMessageContent += c.content });

            // Create combined chat message
            await ChatMessage.create(mergeObject(chatMessageDataArray[0], {
                content: combinedMessageContent,
                rollMode: rollMode || chatMessageDataArray[0].rollMode
            }));
            */
        } else if (roller === "mre") {
            let hk;
            if (game.dice3d) hk = Hooks.on("diceSoNiceRollStart", (messageID, context) => { context.blind = true });

            const originalSetting = game.settings.get("mre-dnd5e", "rollDialogBehaviorLocal");
            game.settings.set("mre-dnd5e", "rollDialogBehaviorLocal", "skip");

            for (const itemName of itemNameArray) {
                const item = actor.items.getName(itemName);
                rollType === "attack" ? await item.rollAttack() : await item.rollDamage();
            }
            game.settings.set("mre-dnd5e", "rollDialogBehaviorLocal", originalSetting);

            if (hk) Hooks.off("diceSoNiceRollStart", hk);

        }
    }
}
