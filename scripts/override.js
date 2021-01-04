import { addChatMessageContextOptions } from "/systems/dnd5e/module/chat.js";

export const coreRollerPatch = () => {
    game.dnd5e.entities.Item5e.prototype.rollAttack = rollAttackMA5e;
    game.dnd5e.entities.Item5e.prototype.rollDamage = rollDamageMA5e;

    Hooks.off("getChatLogEntryContext", addChatMessageContextOptions);
    Hooks.on("getChatLogEntryContext", addChatMessageContextOptionsMA5e);
}
export const blankRoll = new Roll("0").evaluate(); // straight from BR5e

const rollDialogTemplate = "modules/multiattack-5e/templates/MA5e-roll-dialog.html";

const attackDefault = {
    default: 1,
    nums: [
        {
            n: 1,
            def: false
        },
        {
            n: 2,
            def: false
        },
        {
            n: 3,
            def: false
        },
        {
            n: 4,
            def: false
        }
    ]
};
const damageDefault = {
    default: 1,
    nums: [
        {
            n: 1,
            def: false
        },
        {
            n: 2,
            def: false
        },
        {
            n: 3,
            def: false
        },
        {
            n: 4,
            def: false
        }
    ]
};

// Patch Item5e.rollAttack() to call d20RollMA5e()
// No other changes, can copy and paste directly from item/entity.js after future dnd5e updates
async function rollAttackMA5e(options={}) {
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    const flags = this.actor.data.flags.dnd5e || {};
    if ( !this.hasAttack ) {
      throw new Error("You may not place an Attack Roll with this Item.");
    }
    let title = `${this.name} - ${game.i18n.localize("DND5E.AttackRoll")}`;
    const rollData = this.getRollData();

    // Define Roll bonuses
    const parts = [`@mod`];
    if ( !["weapon", "consumable"].includes(this.data.type) || itemData.proficient ) {
      parts.push("@prof");
    }

    // Attack Bonus
    if ( itemData.attackBonus ) parts.push(itemData.attackBonus);
    const actorBonus = actorData?.bonuses?.[itemData.actionType] || {};
    if ( actorBonus.attack ) parts.push(actorBonus.attack);

    // Ammunition Bonus
    delete this._ammo;
    let ammo = null;
    let ammoUpdate = null;
    const consume = itemData.consume;
    if ( consume?.type === "ammo" ) {
      ammo = this.actor.items.get(consume.target);
      if(ammo?.data){
        const q = ammo.data.data.quantity;
        const consumeAmount = consume.amount ?? 0;
        if ( q && (q - consumeAmount >= 0) ) {
          this._ammo = ammo;
          let ammoBonus = ammo.data.data.attackBonus;
          if ( ammoBonus ) {
            parts.push("@ammo");
            rollData["ammo"] = ammoBonus;
            title += ` [${ammo.name}]`;
          }
        }
      }

      // Get pending ammunition update
      const usage = this._getUsageUpdates({consumeResource: true});
      if ( usage === false ) return null;
      ammoUpdate = usage.resourceUpdates || {};
    }

    // Compose roll options
    const rollConfig = mergeObject({
      parts: parts,
      actor: this.actor,
      data: rollData,
      title: title,
      flavor: title,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      dialogOptions: {
        width: 400,
        top: options.event ? options.event.clientY - 80 : null,
        left: window.innerWidth - 710
      },
      messageData: {"flags.dnd5e.roll": {type: "attack", itemId: this.id }}
    }, options);
    rollConfig.event = options.event;

    // Expanded critical hit thresholds
    if (( this.data.type === "weapon" ) && flags.weaponCriticalThreshold) {
      rollConfig.critical = parseInt(flags.weaponCriticalThreshold);
    } else if (( this.data.type === "spell" ) && flags.spellCriticalThreshold) {
      rollConfig.critical = parseInt(flags.spellCriticalThreshold);
    }

    // Elven Accuracy
    if ( ["weapon", "spell"].includes(this.data.type) ) {
      if (flags.elvenAccuracy && ["dex", "int", "wis", "cha"].includes(this.abilityMod)) {
        rollConfig.elvenAccuracy = true;
      }
    }

    // Apply Halfling Lucky
    if ( flags.halflingLucky ) rollConfig.halflingLucky = true;

    // Invoke the d20 roll helper
    const roll = await d20RollMA5e(rollConfig);
    if ( roll === false ) return null;

    // Commit ammunition consumption on attack rolls resource consumption if the attack roll was made
    if ( ammo && !isObjectEmpty(ammoUpdate) ) await ammo.update(ammoUpdate);
    return roll;
}
// Changed inner roll function to handle multiple rolls
async function d20RollMA5e({ parts = [], data = {}, event = {}, rollMode = null, template = null, title = null, speaker = null, flavor = null, fastForward = null, dialogOptions, advantage = null, disadvantage = null, critical = 20, fumble = 1, targetValue = null, elvenAccuracy = false, halflingLucky = false, reliableTalent = false, chatMessage = true, messageData = {} } = {}) {
    // Prepare Message Data
    messageData["flags.multiattack-5e.damageRoll"] = false;
    messageData["flags.multiattack-5e.attackRoll"] = true;
    messageData.flavor = flavor || title;
    messageData.speaker = speaker || ChatMessage.getSpeaker();
    const messageOptions = { rollMode: rollMode || game.settings.get("core", "rollMode") };
    parts = parts.concat(["@bonus"]);

    // Handle fast-forward events
    let adv = 0;
    fastForward = fastForward ?? (event && (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey));
    if (fastForward) {
        if (advantage || event.altKey) adv = 1;
        else if (disadvantage || event.ctrlKey || event.metaKey) adv = -1;
    }

    // Define the inner roll function
    const _roll = (parts, adv, form) => {

        // Determine number of attack rolls to be made based on selection in dialog
        const numRolls = parseInt(form?.numRolls.value) || attackDefault.default;

        // Determine the d20 roll and modifiers
        let nd = 1;
        let mods = halflingLucky ? "r=1" : "";

        // Handle advantage
        if (adv === 1) {
            nd = elvenAccuracy ? 3 : 2;
            messageData.flavor += ` (${game.i18n.localize("DND5E.Advantage")})`;
            if ("flags.dnd5e.roll" in messageData) messageData["flags.dnd5e.roll"].advantage = true;
            mods += "kh";
        }

        // Handle disadvantage
        else if (adv === -1) {
            nd = 2;
            messageData.flavor += ` (${game.i18n.localize("DND5E.Disadvantage")})`;
            if ("flags.dnd5e.roll" in messageData) messageData["flags.dnd5e.roll"].disadvantage = true;
            mods += "kl";
        }

        // Prepend the d20 roll
        let formula = `${nd}d20${mods}`;
        if (reliableTalent) formula = `{${nd}d20${mods},10}kh`;
        parts.unshift(formula);

        // Optionally include a situational bonus
        if (form) {
            data['bonus'] = form.bonus.value;
            messageOptions.rollMode = form.rollMode.value;
        }
        if (!data["bonus"]) parts.pop();

        // Optionally include an ability score selection (used for tool checks)
        const ability = form ? form.ability : null;
        if (ability && ability.value) {
            data.ability = ability.value;
            const abl = data.abilities[data.ability];
            if (abl) {
                data.mod = abl.mod;
                messageData.flavor += ` (${CONFIG.DND5E.abilities[data.ability]})`;
            }
        }

        // Execute the roll (edited from original to roll multiple times and return array of rolls instead of single roll)
        const rolls = [];
        for (let i = 0; i < numRolls; i++) {
            let roll = new Roll(parts.join(" + "), data);
            try {
                roll.roll();
            } catch (err) {
                console.error(err);
                ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
                return null;
            }

            // Flag d20 options for any 20-sided dice in the roll
            for (let d of roll.dice) {
                if (d.faces === 20) {
                    d.options.critical = critical;
                    d.options.fumble = fumble;
                    if (targetValue) d.options.target = targetValue;
                }
            }

            // If reliable talent was applied, add it to the flavor text
            if (reliableTalent && roll.dice[0].total < 10) {
                messageData.flavor += ` (${game.i18n.localize("DND5E.FlagsReliableTalent")})`;
            }

            rolls.push(roll);
        }
        return rolls;
    };

    // Create the Rolls array
    const rolls = fastForward ? _roll(parts, adv) :
        await _d20RollDialogMA5e({ template, title, parts, data, rollMode: messageOptions.rollMode, dialogOptions, roll: _roll });

    if (rolls === null) return null;

    for (let i = 0; i < rolls.length; i++) {
        let r = rolls[i];
        if (r.results[0] >= r.terms[0].options.critical) {
            r.crit = " critical";
        } else if (r.results[0] <= r.terms[0].options.fumble) {
            r.crit = " fumble";
        } else {
            r.crit = "";
        }
        r.tooltip = await r.getTooltip();
    }

    // When called by Multiattack tool
    if (!chatMessage) {
        rolls[0].messageData = messageData;
        return rolls[0];
    };

    /*
    * If only a single roll, then use default toMessage() to generate chat card
    * Else, create chat message manually with custom template for multiple rolls
    */
    if (rolls.length === 1) {
        rolls[0].toMessage(messageData, messageOptions);
        return rolls[0];
    } else {
        // Use custom attackTemplate and data from rolls array to render html content for chat card
        const attackTemplate = "/modules/multiattack-5e/templates/MA5e-attack-roll-chat.html";
        const htmlContent = await renderTemplate(attackTemplate, { rolls: rolls });

        messageData = mergeObject({
            user: game.user._id,
            type: 5,
            sound: CONFIG.sounds.dice,
            content: htmlContent,
            roll: blankRoll
        }, messageData);

        // Animate DSN for all rolls (await on last roll to have all animations finish before generating chat card)
        const customRollerSetting = game.settings.get("multiattack-5e","customRollerDSN");
        if (game.dice3d && (customRollerSetting === "enabled" || customRollerSetting === "attackOnly")) {
            for (let i = 0; i < rolls.length; i++) {
                if (i == rolls.length - 1) {
                    await game.dice3d.showForRoll(rolls[i]);
                } else {
                    game.dice3d.showForRoll(rolls[i]);
                }
            }
        }

        // Create chart card
        ChatMessage.create(messageData);
    }
}
// Change template
async function _d20RollDialogMA5e({ template, title, parts, data, rollMode, dialogOptions, roll } = {}) {

    // Render modal dialog
    //template = template || "systems/dnd5e/templates/chat/roll-dialog.html";
    let dialogData = {
        rollType: "Attacks", // to be replaced with il18n localization -jv
        num: attackDefault.nums,
        checked: attackDefault.default > 1,
        formula: parts.join(" + "),
        data: data,
        rollMode: rollMode,
        rollModes: CONFIG.Dice.rollModes,
        config: CONFIG.DND5E
    };
    const html = await renderTemplate(rollDialogTemplate, dialogData);

    // Create the Dialog window
    return new Promise(resolve => {
        new Dialog({
            title: title,
            content: html,
            buttons: {
                advantage: {
                    label: game.i18n.localize("DND5E.Advantage"),
                    callback: html => resolve(roll(parts, 1, html[0].querySelector("form")))
                },
                normal: {
                    label: game.i18n.localize("DND5E.Normal"),
                    callback: html => resolve(roll(parts, 0, html[0].querySelector("form")))
                },
                disadvantage: {
                    label: game.i18n.localize("DND5E.Disadvantage"),
                    callback: html => resolve(roll(parts, -1, html[0].querySelector("form")))
                }
            },
            default: "normal",
            close: html => {
                // Determine if 'default' checkbox is checked
                const checkValue = html.find("#defaultCheckbox")[0].checked;
                const numRolls = html.find("[name=numRolls]")[0].value;
                if (checkValue) {
                    attackDefault.default = numRolls;
                    attackDefault.nums[numRolls - 1].def = true;
                } else {
                    attackDefault.nums.forEach(n => {
                        n.def = false;
                    });
                    attackDefault.default = 1;
                }
                resolve(null);
            }
        }, dialogOptions).render(true);
    });
}


// Patch Item5e.rollDamage() to call damageRollMA5e()
// No other changes, can copy and paste directly from item/entity.js after future dnd5e updates
function rollDamageMA5e({critical=false, event=null, spellLevel=null, versatile=false, options={}}={}) {
    if ( !this.hasDamage ) throw new Error("You may not make a Damage Roll with this Item.");
    const itemData = this.data.data;
    const actorData = this.actor.data.data;
    const messageData = {"flags.dnd5e.roll": {type: "damage", itemId: this.id }};

    // Get roll data
    const parts = itemData.damage.parts.map(d => d[0]);
    const rollData = this.getRollData();
    if ( spellLevel ) rollData.item.level = spellLevel;

    // Configure the damage roll
    const title = `${this.name} - ${game.i18n.localize("DND5E.DamageRoll")}`;
    const rollConfig = {
      actor: this.actor,
      critical: critical ?? event?.altKey ?? false,
      data: rollData,
      event: event,
      fastForward: event ? event.shiftKey || event.altKey || event.ctrlKey || event.metaKey : false,
      parts: parts,
      title: title,
      flavor: this.labels.damageTypes.length ? `${title} (${this.labels.damageTypes})` : title,
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      dialogOptions: {
        width: 400,
        top: event ? event.clientY - 80 : null,
        left: window.innerWidth - 710
      },
      messageData: messageData
    };

    // Adjust damage from versatile usage
    if ( versatile && itemData.damage.versatile ) {
      parts[0] = itemData.damage.versatile;
      messageData["flags.dnd5e.roll"].versatile = true;
    }

    // Scale damage from up-casting spells
    if ( (this.data.type === "spell") ) {
      if ( (itemData.scaling.mode === "cantrip") ) {
        const level = this.actor.data.type === "character" ? actorData.details.level : actorData.details.spellLevel;
        this._scaleCantripDamage(parts, itemData.scaling.formula, level, rollData);
      }
      else if ( spellLevel && (itemData.scaling.mode === "level") && itemData.scaling.formula ) {
        const scaling = itemData.scaling.formula;
        this._scaleSpellDamage(parts, itemData.level, spellLevel, scaling, rollData);
      }
    }

    // Add damage bonus formula
    const actorBonus = getProperty(actorData, `bonuses.${itemData.actionType}`) || {};
    if ( actorBonus.damage && (parseInt(actorBonus.damage) !== 0) ) {
      parts.push(actorBonus.damage);
    }

    // Add ammunition damage
    if ( this._ammo ) {
      parts.push("@ammo");
      rollData["ammo"] = this._ammo.data.data.damage.parts.map(p => p[0]).join("+");
      rollConfig.flavor += ` [${this._ammo.name}]`;
      delete this._ammo;
    }

    // Scale melee critical hit damage
    if ( itemData.actionType === "mwak" ) {
      rollConfig.criticalBonusDice = this.actor.getFlag("dnd5e", "meleeCriticalDamageDice") ?? 0;
    }

    // Call the roll helper utility
    return damageRollMA5e(mergeObject(rollConfig, options));
}
// Changed inner roll function to handle multiple rolls
async function damageRollMA5e({ parts, actor, data, event = {}, rollMode = null, template, title, speaker, flavor, allowCritical = true, critical = false, criticalBonusDice = 0, criticalMultiplier = 2, fastForward = null, dialogOptions = {}, chatMessage = true, messageData = {} } = {}) {

    // Prepare Message Data
    messageData["flags.multiattack-5e.damageRoll"] = true;
    messageData.flavor = flavor || title;
    messageData.speaker = speaker || ChatMessage.getSpeaker();
    const messageOptions = { rollMode: rollMode || game.settings.get("core", "rollMode") };
    parts = parts.concat(["@bonus"]);
    fastForward = fastForward ?? (event && (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey));

    // Define inner roll function
    const _roll = function (parts, crit, form) {

        // Determine number of attack rolls to be made based on selection in dialog
        const numRolls = parseInt(form?.numRolls.value) || damageDefault.default;

        // Optionally include a situational bonus
        if (form) {
            data['bonus'] = form.bonus.value;
            messageOptions.rollMode = form.rollMode.value;
        }
        if (!data["bonus"]) parts.pop();

        let rolls = [];
        for (let i = 0; i < numRolls; i++) {
            // Create the damage roll
            let roll = new Roll(parts.join("+"), data);

            // Modify the damage formula for critical hits
            if (crit === true) {
                roll.alter(criticalMultiplier, 0);      // Multiply all dice
                if (roll.terms[0] instanceof Die) {   // Add bonus dice for only the main dice term
                    roll.terms[0].alter(1, criticalBonusDice);
                    roll._formula = roll.formula;
                }
                messageData.flavor += ` (${game.i18n.localize("DND5E.Critical")})`;
                if ("flags.dnd5e.roll" in messageData) messageData["flags.dnd5e.roll"].critical = true;
            }

            // Execute the roll
            try {
                roll.roll();
            } catch (err) {
                console.error(err);
                ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
                return null;
            }
            rolls.push(roll)
        }
        return rolls;
    };

    // Create the Rolls array
    const rolls = fastForward ? _roll(parts, critical || event.altKey) :
        await _damageRollDialogMA5e({ template, title, parts, data, allowCritical, rollMode: messageOptions.rollMode, dialogOptions, roll: _roll });

    if (rolls === null) return null;

    for (let i = 0; i < rolls.length; i++) {
        let r = rolls[i];
        r.tooltip = await r.getTooltip();
    }

    // When called by Multiattack tool
    if (!chatMessage) {
        rolls[0].messageData = messageData;
        return rolls[0];
    };

    /*
    * If only a single roll, then use default toMessage() to generate chat card
    * Else, create chat message manually with custom template for multiple rolls
    */
    if (rolls.length === 1) {
        rolls[0].toMessage(messageData, messageOptions);
        return rolls[0];
    } else {
        // Append roll objects to compile properly with damageTemplate
        let totalDamage = 0;
        rolls.forEach(r => {
            totalDamage += r.total;
        });

        // Add flag for use in damage application
        messageData["flags.multiattack-5e.totalDamage"] = totalDamage;

        // Use custom attackTemplate and data from rolls array to render html content for chat card
        const damageTemplate = "/modules/multiattack-5e/templates/MA5e-damage-roll-chat.html";
        const htmlContent = await renderTemplate(damageTemplate, { rolls: rolls, totalDamage: totalDamage });

        messageData = mergeObject({
            user: game.user._id,
            type: 5,
            sound: CONFIG.sounds.dice,
            content: htmlContent,
            roll: blankRoll
        }, messageData);

        // Animate DSN for all rolls (await on last roll to have all animations finish before generating chat card)
        const customRollerDSN = game.settings.get("multiattack-5e","customRollerDSN");
        if (game.dice3d && (customRollerDSN === "enabled" || customRollerDSN === "damageOnly")) {
            for (let i = 0; i < rolls.length; i++) {
                if (i == rolls.length - 1) {
                    await game.dice3d.showForRoll(rolls[i]);
                } else {
                    game.dice3d.showForRoll(rolls[i]);
                }
            }
        }

        // Create chart card
        ChatMessage.create(messageData);
    }
}
// Change template
async function _damageRollDialogMA5e({ template, title, parts, data, allowCritical, rollMode, dialogOptions, roll } = {}) {

    // Render modal dialog
    //template = template || "systems/dnd5e/templates/chat/roll-dialog.html";
    let dialogData = {
        rollType: "Hits", // to be replaced with il18n localization -jv
        num: damageDefault.nums,
        checked: damageDefault.default > 1,
        formula: parts.join(" + "),
        data: data,
        rollMode: rollMode,
        rollModes: CONFIG.Dice.rollModes
    };
    const html = await renderTemplate(rollDialogTemplate, dialogData);

    // Create the Dialog window
    return new Promise(resolve => {
        new Dialog({
            title: title,
            content: html,
            buttons: {
                critical: {
                    condition: allowCritical,
                    label: game.i18n.localize("DND5E.CriticalHit"),
                    callback: html => resolve(roll(parts, true, html[0].querySelector("form")))
                },
                normal: {
                    label: game.i18n.localize(allowCritical ? "DND5E.Normal" : "DND5E.Roll"),
                    callback: html => resolve(roll(parts, false, html[0].querySelector("form")))
                },
            },
            default: "normal",
            close: html => {
                // Determine if 'default' checkbox is checked
                const checkValue = html.find("#defaultCheckbox")[0].checked;
                const numRolls = html.find("[name=numRolls]")[0].value;
                if (checkValue) {
                    damageDefault.default = numRolls;
                    damageDefault.nums[numRolls - 1].def = true;
                } else {
                    damageDefault.nums.forEach(n => {
                        n.def = false;
                    });
                    damageDefault.default = 1;
                }
                resolve(null);
            }
        }, dialogOptions).render(true);
    });
}


// Functions based on addChatMessageContextOptions() and applyChatCardDamage()
// Change call back to custom function that checks chat message flags for MA5e total damage data to apply to selected actors
const addChatMessageContextOptionsMA5e = function (html, options) {
    let canApply = li => {
        const message = game.messages.get(li.data("messageId"));
        return message["data.flags.multiattack-5e.multiItemAttack"] || message["data.flags.multiattack-5e.attackRoll"] ? false : message.isRoll && message.isContentVisible && canvas.tokens.controlled.length;
    };
    options.push(
        {
            name: game.i18n.localize("DND5E.ChatContextDamage"),
            icon: '<i class="fas fa-user-minus"></i>',
            condition: canApply,
            callback: li => applyChatCardDamageMA5e(li, 1)
        },
        {
            name: game.i18n.localize("DND5E.ChatContextHealing"),
            icon: '<i class="fas fa-user-plus"></i>',
            condition: canApply,
            callback: li => applyChatCardDamageMA5e(li, -1)
        },
        {
            name: game.i18n.localize("DND5E.ChatContextDoubleDamage"),
            icon: '<i class="fas fa-user-injured"></i>',
            condition: canApply,
            callback: li => applyChatCardDamageMA5e(li, 2)
        },
        {
            name: game.i18n.localize("DND5E.ChatContextHalfDamage"),
            icon: '<i class="fas fa-user-shield"></i>',
            condition: canApply,
            callback: li => applyChatCardDamageMA5e(li, 0.5)
        }
    );
    return options;
};

function applyChatCardDamageMA5e(li, multiplier) {
    const message = game.messages.get(li.data("messageId"));
    const amount = message["data.flags.multiattack-5e.totalDamage"] || li.find('.dice-total').text();
    return Promise.all(canvas.tokens.controlled.map(t => {
        const a = t.actor;
        return a.applyDamage(amount, multiplier);
    }));
}