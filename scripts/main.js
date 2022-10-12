const moduleID = 'multiattack-5e';
let roller = 'core';
let ma5e;

const logg = x => console.log(x);

const delay = async ms => {
    await new Promise(resolve => setTimeout(resolve, ms));
};

const ma5eLocalize = key => game.i18n.localize(`${moduleID}.${key}`);


Hooks.once('init', () => {
    // Open module API.
    game.modules.get(moduleID).api = Multiattack5e;
    ma5e = game.modules.get(moduleID).api;

    // Register module settings.
    game.settings.register(moduleID, 'condenseChatMessagesEnabled', {
        name: ma5eLocalize('settings.condenseChatMessagesEnabled.name'),
        scope: 'world',
        config: roller === 'core',
        type: Boolean,
        default: true
    });

    game.settings.register(moduleID, 'multiattackToolEnabled', {
        name: ma5eLocalize('settings.multiattackToolEnabled.name'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        onChange: () => ui.controls.render(true)
    });

    game.settings.register(moduleID, 'playerToolEnabled', {
        name: ma5eLocalize('settings.playerToolEnabled.name'),
        hint: ma5eLocalize('settings.playerToolEnabled.hint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(moduleID, 'extraAttackDSN', {
        name: ma5eLocalize('settings.extraAttackDSN.name'),
        hint: ma5eLocalize('settings.extraAttackDSN.hint'),
        scope: 'world',
        config: game.modules.get('dice-so-nice')?.active && roller === 'core',
        type: String,
        choices: {
            disabled: ma5eLocalize('settings.disabled'),
            attack: ma5eLocalize('settings.attackOnly'),
            damage: ma5eLocalize('settings.damageOnly'),
            enabled: ma5eLocalize('settings.enabled'),
        },
        default: 'enabled'
    });

    game.settings.register(moduleID, 'multiattackDSN', {
        name: ma5eLocalize('settings.multiattackDSN.name'),
        scope: 'world',
        config: game.modules.get('dice-so-nice')?.active && roller === 'core',
        type: String,
        choices: {
            disabled: ma5eLocalize('settings.disabled'),
            attack: ma5eLocalize('settings.attackOnly'),
            damage: ma5eLocalize('settings.damageOnly'),
            enabled: ma5eLocalize('settings.enabled'),
        },
        default: 'enabled'
    });

});


// Add multiattack tool button to token control bar.
Hooks.on('getSceneControlButtons', controls => {
    const bar = controls.find(c => c.name === 'token');
    bar.tools.push({
        name: 'multiattackTool',
        title: ma5eLocalize('tool.control.title'),
        icon: 'fa-solid fa-swords',
        onClick: ma5e.multiattackTool.bind(),
        button: true
    })
});

// Add extra attack select to attack/damage roll configuration dialogs.
Hooks.on('renderDialog', async (dialog, $html, appData) => {
    const html = $html[0];
    // Filter for target dialogs.
    const { title } = dialog.data;
    const attackRollText = game.i18n.localize('DND5E.AttackRoll');
    const damageRollText = game.i18n.localize('DND5E.DamageRoll');
    if (!title.includes(attackRollText) && !title.includes(damageRollText)) return;

    // Inject number-of-rolls select element.
    const numberOfRollsSelect = document.createElement('div');
    numberOfRollsSelect.classList.add('form-group');
    numberOfRollsSelect.innerHTML = `
        <label>${ma5eLocalize("dialog.numberOfRolls")}</label>
        <select name="number-of-rolls">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
        </select>
    `;
    html.querySelector('form').append(numberOfRollsSelect);
    html.style.height = 'auto';

    // Override roll button callbacks.
    for (const vantage of Object.keys(dialog.data.buttons)) {
        const ogCallback = dialog.data.buttons[vantage].callback;
        dialog.data.buttons[vantage].callback = ([html]) => {
            const isAttackRoll = title.includes(attackRollText);
            const numberOfRolls = parseInt(html.querySelector('select[name="number-of-rolls"]').value) || 1;
            if (numberOfRolls !== 1) {
                const hook = isAttackRoll ? 'rollAttack' : 'rollDamage';
                const sitBonus = html.querySelector('input[name="bonus"]').value; // Get situational bonus from prime roll to apply to future rolls.

                const condenseChatMessages = game.settings.get(moduleID, 'condenseChatMessagesEnabled');
                let messageData;
                // If condenseChatMessages setting enabled, prevent prime roll chat message.
                if (condenseChatMessages) {
                    Hooks.once('preCreateChatMessage', (message, data, options, userID) => {
                        messageData = data;
                        return false;
                    });
                }

                // Prepare to intercept prime roll to pass itemIDarray to Multiattack5e.multiattack.
                Hooks.once(`dnd5e.${hook}`, async (item, primeRoll, ammoUpdate) => {
                    const itemIDarray = [];
                    for (let i = 1; i < numberOfRolls; i++) itemIDarray.push(item.id);

                    const ma5eData = {
                        actor: item.parent,
                        itemIDarray,
                        messageData,
                        primeRoll,
                        isAttackRoll,
                        isExtraAttack: true,
                        rollMode: primeRoll.options.rollMode,
                        sitBonus,
                        vantage,
                        isCritical: primeRoll.isCritical
                    };
                    ma5eData.primeRoll.id = item.id;

                    await ma5e.multiattack(ma5eData);
                });
            }

            // Call original callback to initiate prime roll.
            let vantageMode;
            if (isAttackRoll) vantageMode = CONFIG.Dice.D20Roll.ADV_MODE[vantage];
            else vantageMode = vantage === 'critical';

            return ogCallback($html, vantageMode);
        };
    }
});


class Multiattack5e {

    static async multiattack({
        actor,
        itemNameArray = [], itemIDarray = [], chatMessage = true, messageData, primeRoll,
        isAttackRoll = true, isExtraAttack = false,
        rollMode = 'publicroll', sitBonus, vantage = 'normal', isCritical = false
    }) {

        actor = actor || canvas.tokens.controlled[0]?.actor;
        if (!actor) return;
        const isIDs = itemIDarray.length;
        const itemArray = isIDs ? itemIDarray : itemNameArray;
        if (!itemArray.length) return;

        // Assume messageData if none provided.
        if (!messageData) {
            messageData = {
                speaker: ChatMessage.getSpeaker({ actor }),
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            };
        }

        // Build array of rolls.
        const rollMethod = isAttackRoll ? CONFIG.Item.documentClass.prototype.rollAttack : CONFIG.Item.documentClass.prototype.rollDamage;
        const condenseChatMessages = game.settings.get(moduleID, 'condenseChatMessagesEnabled');
        let rollOptions;
        const commonRollOptions = {
            fastForward: true,
            chatMessage: !condenseChatMessages // Prevent extra roll chat messages if condenseChatMessages enabled.
        };
        if (isAttackRoll) {
            rollOptions = commonRollOptions;
            rollOptions.advantage = vantage === 'advantage';
            rollOptions.disadvantage = vantage === 'disadvantage';
        } else {
            rollOptions = {
                critical: isCritical,
                options: commonRollOptions
            };
        }
        const preHook = isAttackRoll ? 'preRollAttack' : 'preRollDamage';
        const hk = Hooks.on(`dnd5e.${preHook}`, (item, rollConfig) => {
            if (sitBonus) rollConfig.parts.push(sitBonus);
        });
        let rollOrder = 1;
        const rolls = [];
        if (primeRoll) rolls.push(primeRoll);
        for (const id of itemArray) {
            const item = isIDs ? actor.items.get(id) : actor.items.getName(id);
            const r = await rollMethod.call(item, rollOptions);
            if (r) {
                r.id = id;
                if (rollMode === 'publicroll' && isExtraAttack) {
                    r.dice[0].options.rollOrder = rollOrder;
                    rollOrder++;
                }
                rolls.push(r);
            }

            await delay(100); // Short delay to allow roll to complete ammoUpdate.
        }
        Hooks.off(`dnd5e.${preHook}`, hk);

        // Build templateData for rendering custom condensed chat message template.
        const templateData = {
            items: {}
        };
        for (const roll of rolls) {
            roll.tooltip = await roll.getTooltip();
            if (isAttackRoll) {
                if (roll.isCritical) roll.highlight = 'critical';
                else if (roll.isFumble) roll.highlight = 'fumble';
                else roll.highlight = '';
            }
            const { id }  = roll;
            if (!templateData.items[id]) {
                templateData.items[id] = {
                    flavor: roll.options.flavor,
                    formula: roll.formula,
                    rolls: [roll]
                };
                if (roll.hasAdvantage) templateData.items[id].flavor += ` (${game.i18n.localize("DND5E.Advantage")})`;
                if (roll.hasDisadvantage) templateData.items[id].flavor += ` (${game.i18n.localize("DND5E.Disadvantage")})`;
            } else templateData.items[id].rolls.push(roll);
        }

        // Subsequent processing only applies to condensed chat messages.
        if (!condenseChatMessages) return rolls;

        // Attach rolls array to messageData for DsN integration and total damage application.
        messageData.rolls = rolls;

        // Calculate total damage if damage roll.
        if (!isAttackRoll) templateData.totalDamage = rolls.reduce((acc, current) => { return acc += current.total }, 0);

        // Render template.
        const content = await renderTemplate(`modules/${moduleID}/templates/condensed-chat-message.hbs`, templateData);
        messageData.content = content;

        // Compatibility with Semi-Private Rolls.
        messageData.flags = {
            'semi-private-rolls': {
                flavor: messageData.flavor
            }
        };
        // Flavor is already included in custom template.
        delete messageData.flavor;

        // Conditionally hide DsN based on extraAttackDSN setting.
        const dsn = isExtraAttack 
            ? game.settings.get(moduleID, 'extraAttackDSN')
            : game.settings.get(moduleID, 'multiattackDSN');
        if (dsn !== 'enabled' && (extraAttackDSN === 'disabled' || dsn !== rollType)) {
            Hooks.once('diceSoNiceRollStart', (id, context) => { context.blind = true });
        }

        // Create condensed chat message.
        if (chatMessage) await ChatMessage.create(messageData, { rollMode });

        return rolls;
    }

    static async multiattackTool() {
        if (canvas.tokens.controlled.length !== 1) return ui.notifications.warn(ma5eLocalize('ui.selectOneToken')); // Tool only works for a single selected token.

        const [tokenObj] = canvas.tokens.controlled;
        const { actor } = tokenObj;

        // Build template data from actor's weapons.
        const templateData = {
            items: []
        };
        for (const item of actor.items) {
            if (item.type !== 'weapon' || !item.hasAttack) continue;

            const { id, name, img } = item;
            const itemData = {
                id,
                name,
                img
            };
            templateData.items.push(itemData);
        }
        const content = await renderTemplate(`modules/${moduleID}/templates/multiattack-tool-dialog.hbs`, templateData);
        const buttonPosition = document.querySelector(`li.control-tool[data-tool="multiattackTool"]`);
        const dialogOptions = {
            id: 'multiattack-tool-dialog',
            width: 250,
            top: buttonPosition.offsetTop,
            left: buttonPosition.offsetLeft + 50,
            resizable: false
        };

        let rollType;
        new Dialog({
            title: ma5eLocalize('tool.dialog.title'),
            content,
            buttons: {
                attack: {
                    label: game.i18n.localize('DND5E.Attack'),
                    callback: () => rollType = 'attack'
                },
                damage: {
                    label: game.i18n.localize('DND5E.Damage'),
                    callback: () => rollType = 'damage'
                }
            },
            render: ([html]) => {
                // Apply default multiattack data.
                const defaultMultiattack = tokenObj.document.getFlag(moduleID, 'defaultMultiattack');
                if (defaultMultiattack) {
                    for (const itemID of defaultMultiattack) {
                        const option = html.querySelector(`div#${itemID}`);
                        if (!option) continue;

                        const input = option.querySelector('input[type="number"]');
                        input.value = input.value ? parseInt(input.value) + 1 : 1;
                        const checkbox = option.querySelector('input[type="checkbox"]');
                        checkbox.checked = true;
                    }
                }

                // Add click eventListeners for setting/clearing default multiattack.
                html.querySelector('#setDefaultButton').addEventListener('click', setDefault);
                html.querySelector('#clearDefaultButton').addEventListener('click', clearDefault);

                const tokenDoc = tokenObj.document;
                function setDefault() {
                    const itemIDarray = toolDataToItemIDarray(html);
                    tokenDoc.setFlag(moduleID, 'defaultMultiattack', itemIDarray);
                    ui.notifications.info(`${ma5eLocalize("ui.setDefault")} ${tokenDoc.name}.`);
                }

                function clearDefault() {
                    const checkboxes = html.querySelectorAll(`input.${moduleID}-checkbox`);
                    const inputs = html.querySelectorAll('input.multiattack-5e-input');
                    for (let i = 0; i < checkboxes.length; i++) {
                        checkboxes[i].checked = false;
                        inputs[i].value = null;
                    }

                    tokenDoc.unsetFlag(moduleID, 'defaultMultiattack');
                    ui.notifications.warn(`${ma5eLocalize('ui.clearDefault')} ${tokenDoc.name}`);
                }
            },
            close: async ([html]) => {
                if (!rollType) return;

                // Build itemIDarray.
                const itemIDarray = toolDataToItemIDarray(html);

                // Send itemIDarray to Multiattack5e.multiattack.
                await ma5e.multiattack({
                    actor,
                    itemIDarray,
                    isAttackRoll: rollType === 'attack',
                    rollMode: game.settings.get('core', 'rollMode')
                });
            }
        }, dialogOptions).render(true);


        function toolDataToItemIDarray(html) {
            const itemIDarray = [];
            const items = html.querySelectorAll(`div.${moduleID}-item`);
            items.forEach(div => {
                const checkbox = div.querySelector('input[type="checkbox"]');
                if (!checkbox.checked) return;

                const num = parseInt(div.querySelector(`input[type="number"]`).value) || 1;
                for (let i = 0; i < num; i++) itemIDarray.push(div.id);
            });

            return itemIDarray;
        }
    }
}