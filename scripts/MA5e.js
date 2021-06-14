export default class MA5e {
    constructor() {
        this.og_rollAttack = CONFIG.Item.documentClass.prototype.rollAttack;
        this.og_rollDamage = CONFIG.Item.documentClass.prototype.rollDamage;
    }

    coreInit() {
        console.log("MA5e | coreInit");

        // Inject extra attack number selector to attack/damage roll configuration dialog
        Hooks.on("renderDialog", async (dialog, html, dialogData) => {
            if (!(dialog.data.title.includes(game.i18n.localize("DND5E.AttackRoll")) || dialog.data.title.includes(game.i18n.localize("DND5E.DamageRoll")))) return;
            const snippet = await renderTemplate("modules/multiattack-5e/templates/roll-dialog-snippet.hbs", {});
            html.find("form").append(snippet);
            html[0].style.height = "auto";
        });

        // "Patch" chat message context menu behavior to enable multiattack total damage application
        Hooks.once("getChatLogEntryContext", (html, options) => {
            const multiplier = [1, -1, 2, 0.5];
            for (let i = 3; i < options.length; i++) options[i].callback = li => applyChatCardDamageMA5e.call(null, li, multiplier[i - 3]);

            function applyChatCardDamageMA5e(li, multiplier) {
                const message = game.messages.get(li.data("messageId"));
                const amount = message.data.flags["multiattack-5e"]?.totalDamage || message.roll.total;
                return Promise.all(canvas.tokens.controlled.map(t => {
                    const a = t.actor;
                    return a.applyDamage(amount, multiplier);
                }));
            }
        });

        // Patch Attack button click
        CONFIG.Item.documentClass.prototype.rollAttack = newRollAttackDamage;
        // Patch attack roll config dialog button callbacks to add extraAttack key to roll.options
        const og_D20Roll = CONFIG.Dice.rolls.find(r => r.name === "D20Roll");
        const og_D20_onDialogSubmit = og_D20Roll.prototype._onDialogSubmit;
        og_D20Roll.prototype._onDialogSubmit = new_onDialogSubmit;

        // Patch Damage button click
        CONFIG.Item.documentClass.prototype.rollDamage = newRollAttackDamage;
        // Patch damage roll config dialog button callbacks to add extraAttack key to roll.options
        const og_damageRoll = CONFIG.Dice.rolls.find(r => r.name === "DamageRoll");
        const og_damage_onDialogSubmit = og_damageRoll.prototype._onDialogSubmit;
        og_damageRoll.prototype._onDialogSubmit = new_onDialogSubmit;

        function new_onDialogSubmit(html, advantageCrit) {
            // Determine roll type based on number of buttons in dialog html
            const rollType = html.find("button").length === 3 ? "attack" : "damage";
            // Call original method to apply configurations to prime roll
            const roller = rollType === "attack" ? og_D20_onDialogSubmit : og_damage_onDialogSubmit;
            const roll = roller.call(this, html, advantageCrit);
            // Add (total) number of rolls to make
            const numRolls = parseInt(html.find("#numRolls").val());
            roll.options.extraAttack = numRolls;
            // Save roll mode
            const rollMode = html.find("select[name='rollMode']").val();
            roll.options.rollMode = rollMode;
            return roll;
        }

        async function newRollAttackDamage(arg) {
            // Determine roll type based on presence of "critical" key in argument object
            const rollType = "critical" in arg ? "damage" : "attack";
            // When Attack/Damage button clicked, register hook to handle upcoming roll chat message
            const hookID = Hooks.once("preCreateChatMessage", handleChat.bind(this));
            // Make "prime" roll to base extra rolls on
            let primeRoll;
            if (rollType === "attack") primeRoll = await game.MA5e.og_rollAttack.call(this, arg);
            if (rollType === "damage") primeRoll = await game.MA5e.og_rollDamage.call(this, arg);
            // If no prime roll is made (i.e. config dialog is closed), unregister hook callback
            if (!primeRoll) Hooks.off("preCreateChatMessage", hookID);

            function handleChat(...hookArgs) {
                // Get chat message entity and chat message data from hook arguments (destructuring assignment)
                const [chatMessage, chatMessageData] = hookArgs;
                const primeRoll = chatMessage.roll;
                const rollMode = primeRoll.options.rollMode;
                // If for some reason hook catches a chat message that is not the expected roll, exit
                if (!chatMessage.isRoll) return true;
                // If fast forward roll, exit (default to single roll)
                if (!chatMessage.roll.options.extraAttack) return true;
                // If only single roll is being made (1 selected in dialog)
                if (chatMessage.roll.options.extraAttack === 1) return true;

                // Make extra rolls and generate single chat card
                if (rollType === "attack") extraAttackRolls.call(this);
                if (rollType === "damage") extraDamageRolls.call(this);
                // Prevent rest of hook chain (i.e. suppress original roll chat message creation)
                return false;

                async function extraAttackRolls() {
                    // Prepare roll options for extra rolls based on prime roll
                    const rollOptions = primeRoll.options;
                    // Generate tooltip for roll and store in roll.options (for use in rendering template later)
                    primeRoll.options.tooltip = await primeRoll.getTooltip();
                    // Prevent extra rolls from generating config dialogs and chat messages
                    rollOptions.fastForward = true;
                    rollOptions.chatMessage = false;
                    // Reconstitute roll parts and situational bonuses
                    rollOptions.parts = primeRoll.formula.split("+").splice(1);
                    // Reconstitute dis/advantage
                    rollOptions.advantage = primeRoll.hasAdvantage;
                    rollOptions.disadvantage = primeRoll.hasDisadvantage;

                    // Initialize rollArray with prime roll data
                    const rollArray = {};
                    rollArray.flavor = chatMessageData.flavor;
                    rollArray.formula = primeRoll.formula;
                    rollArray.rolls = [primeRoll];
                    // Make extra attack rolls based on prime roll
                    for (let i = 0; i < primeRoll.options.extraAttack - 1; i++) {
                        // Call original roll function to handle resource consumption
                        const roll = await game.MA5e.og_rollAttack.call(this, rollOptions);
                        // Generate tooltip for roll
                        roll.options.tooltip = await roll.getTooltip();
                        // Add CSS highlighting for critical success/failure
                        roll.options.highlight = roll.terms[0].total > primeRoll.options.critical - 1 ? "critical" : roll.terms[0].total < primeRoll.options.fumble + 1 ? "fumble" : "";
                        // Add roll to rollArray
                        rollArray.rolls.push(roll);
                    }

                    // Generate chat message
                    game.MA5e.generateChatMessage({rollArray: [rollArray], speaker: chatMessageData.speaker, rollMode, rollType});
                }

                async function extraDamageRolls() {
                    // Generate tooltip for roll and store in roll.options (for use in rendering template later)
                    primeRoll.options.tooltip = await primeRoll.getTooltip();
                    // Prepare roll options for extra rolls based on prime roll
                    const rollOptions = {};
                    // Prevent extra rolls from generating config dialogs and chat messages
                    rollOptions.fastForward = true;
                    rollOptions.chatMessage = false;
                    // Reconstitute roll parts and data based on prime roll
                    rollOptions.parts = primeRoll.formula.split("+");
                    rollOptions.data = primeRoll.data;
                    // Extra damage roll formula already accounts for critica
                    rollOptions.critical = false;
                    // Required to get around an event check
                    rollOptions.event = { altKey: false };

                    // Initialize rollArray and totalDamage with prime roll
                    const rollArray = {};
                    rollArray.formula = primeRoll.formula;
                    rollArray.flavor = chatMessageData.flavor;
                    rollArray.rolls = [primeRoll];
                    let totalDamage = primeRoll.total;
                    //  Call damageRoll() from dice.js to create extra damage rolls
                    for (let i = 0; i < primeRoll.options.extraAttack - 1; i++) {
                        const roll = await game.dnd5e.dice.damageRoll(rollOptions);
                        // Generate tooltip for roll
                        roll.options.tooltip = await roll.getTooltip();
                        // Add roll to rollArray
                        rollArray.rolls.push(roll);
                        // Add roll total to running total damage
                        totalDamage += roll.total;
                    }

                    // Generate chat message
                    game.MA5e.generateChatMessage({rollArray: [rollArray], speaker:chatMessageData.speaker, totalDamage, rollMode, rollType});
                }
            }
        }
    }

    async multiattack(itemNameArray, rollType = "attack", actor = null) {
        itemNameArray.sort();
        if (!actor && canvas.tokens.controlled.length !== 1) return ui.notifications.warn(game.i18n.localize("multiattack.ui.selectOneToken"));
        actor = actor || canvas.tokens.controlled[0].actor;

        const rollArray = [];
        let totalDamage = 0;
        let itemIndex = 0;
        rollArray[itemIndex] = {};
        rollArray[itemIndex].rolls = [];
        rollArray[itemIndex].itemName = itemNameArray[0];
        for (let i = 0; i < itemNameArray.length; i++) {
            const item = actor.items.getName(itemNameArray[i]);
            if (!item) return ui.notifications.warn(`No item named "${itemNameArray[i]}" found.`);
            let roll;
            if (rollType === "attack") roll = await game.MA5e.og_rollAttack.call(item, { fastForward: true, chatMessage: false });
            if (rollType === "damage") {
                roll = await game.MA5e.og_rollDamage.call(item, { event: { altKey: false }, options: { fastForward: true, chatMessage: false } });
                totalDamage += roll.total;
            }
            if (!roll) return;
            roll.options.tooltip = await roll.getTooltip();
            if (rollType === "attack") roll.options.highlight = roll.terms[0].total > roll.options.critical - 1 ? "critical" : roll.terms[0].total < roll.options.fumble + 1 ? "fumble" : "";
            rollArray[itemIndex].rolls.push(roll);

            if (i === itemNameArray.length - 1) break;
            if (itemNameArray[i] !== itemNameArray[i + 1]) {
                itemIndex += 1;
                rollArray[itemIndex] = {}
                rollArray[itemIndex].rolls = [];
                rollArray[itemIndex].itemName = itemNameArray[i + 1];
            }
        }

        const rollText = rollType === "attack" ? game.i18n.localize("DND5E.AttackRoll") : game.i18n.localize("DND5E.DamageRoll");
        for (let item of rollArray) {
            item.flavor = `${item.itemName} - ${rollText}`;
            item.formula = `${item.rolls[0].formula}`;
        }

        game.MA5e.generateChatMessage({rollArray, speaker: ChatMessage.getSpeaker({ actor }), totalDamage, rollType, multiattack: true});

        return rollArray;
    }

    async generateChatMessage({rollArray, speaker, totalDamage = false, rollMode = false, rollType = "attack", multiattack = false} = {}) {
        // Render chat message content using custom template
        const content = await renderTemplate("modules/multiattack-5e/templates/multiattack-chat.hbs", { outerRolls: rollArray, totalDamage });
        // Create chat messageData
        const messageData = {
            speaker,
            type: 5, // Set chat message as Roll-type chat message to allow hiding with gm/blind/self roll modes
            sound: CONFIG.sounds.dice,
            content,
            roll: await new Roll("0").evaluate(), // "blank" roll
            rollMode: rollMode || game.settings.get("core", "rollMode"),
            flags: { "multiattack-5e": { totalDamage } }
        };

        // If Dice So Nice! module is active, render 3D dice before creating chat message
        let dsn = game.modules.get("dice-so-nice")?.active;
        const dsnMultiattack = game.settings.get("multiattack-5e", "multiattackDSN");
        const dsnExtraAttack = game.settings.get("multiattack-5e", "extraAttackDSN");
        if (dsn) {
            if (multiattack) {
                if (!(dsnMultiattack === "enabled" || dsnMultiattack === rollType)) dsn = false;
            } else {
                if (!(dsnExtraAttack === "enabled" || dsnExtraAttack === rollType)) dsn = false;
            }
        }
        if (dsn) {
            for (let i = 0; i < rollArray.length; i++) {
                for (let j = 0; j < rollArray[i].rolls.length; j++) {
                    if (i === rollArray.length && j === rollArray[i].rolls.length) await game.dice3d.showForRoll(rollArray[i].rolls[j], game.user, true);
                    else game.dice3d.showForRoll(rollArray[i].rolls[j], game.user, messageData.rollMode === "roll");
                }
            }
        }
    
        // Create custom chat message
        ChatMessage.create(messageData);
    }


    defaultMultiattack(token, rollType = "attack") {
        const defaultMultiattack = game.MA5e.getToolDefault(token.actor);
        return game.MA5e.multiattack(defaultMultiattack, rollType);
    }

    multiattackToolInit() {
        Hooks.on("getSceneControlButtons", (controls) => {
            const bar = controls.find(c => c.name === "token");
            bar.tools.push({
                name: "Multiattack Tool",
                title: game.i18n.localize("multiattack-5e.tool.control.title"),
                icon: "fas fa-fist-raised",
                onClick: game.MA5e.multiattackToolDialog.bind(),
                button: true
            });
        });
    }

    async multiattackToolDialog() {
        if (canvas.tokens.controlled.length !== 1) return ui.notifications.warn(game.i18n.localize("multiattack-5e.ui.selectOneToken"));
        const actor = canvas.tokens.controlled[0].actor;
        const weapons = actor.items.filter(i => i.hasAttack && i.type === "weapon");
        const toolDefault = game.MA5e.getToolDefault(actor);

        for (let weapon of weapons) {
            weapon.count = null;
            weapon.checked = false;
            if (toolDefault?.includes(weapon.name)) {
                weapon.count = toolDefault.filter(itemName => itemName === weapon.name).length;
                weapon.checked = true;
            }
        }

        const content = await renderTemplate("modules/multiattack-5e/templates/multiattack-tool-dialog.hbs", { weapons });
        const buttonPosition = $(document).find(`li.control-tool[title="Multiattack"]`).offset();
        const dialogOptions = {
            id: "multiattack-tool-dialog",
            width: 250,
            top: buttonPosition.top,
            left: buttonPosition.left + 50
        };

        let rollType, itemNameArray;
        const buttons = {
            attack: {
                label: game.i18n.localize("DND5E.Attack"),
                callback: (html) => {
                    rollType = "attack";
                    itemNameArray = game.MA5e.buildItemNameArray(html);
                }
            },
            damage: {
                label: game.i18n.localize("DND5E.Damage"),
                callback: (html) => {
                    rollType = "damage";
                    itemNameArray = game.MA5e.buildItemNameArray(html);
                }
            }
        };
        if (game.modules.get("midi-qol")?.active) delete buttons.damage;
        await new Promise(resolve => {
            new Dialog({
                title: `${game.i18n.localize("multiattack-5e.tool.dialog.title")} - ${actor.name}`,
                content,
                buttons,
                default: "attack",
                close: () => resolve()
            }, dialogOptions).render(true);
        });

        if (!itemNameArray) return;
        if (game.modules.get("midi-qol")?.active) return game.MA5e.midiMA5e(itemNameArray, actor);
        if (game.modules.get("betterrolls5e")?.active) return game.MA5e.brMA5E(itemNameArray, actor);
        return game.MA5e.multiattack(itemNameArray, rollType, actor);
    }

    brMA5E(itemNameArray, actor) {
        if (!game.settings.get("multiattack-5e", "betterRollsDSN")) {
            Hooks.once("diceSoNiceRollStart", (messageID, context) => {context.blind = true});
        } 
        const card = BetterRolls.rollItem(actor);
        let item = actor.items.getName(itemNameArray[0]);
        card.addField("header", { img: item.img, title: item.name });
        for (let i = 0; i < itemNameArray.length; i++) {
            item = actor.items.getName(itemNameArray[i]);
            card.addField("attack", { item });
            card.addField("damage", { item, index: "all" });

            if (i === itemNameArray.length - 1) break;
            if (itemNameArray[i] !== itemNameArray[i + 1]) {
                item = actor.items.getName(itemNameArray[i + 1]);
                card.addField("header", { img: item.img, title: item.name });
            }

        }

        card.toMessage();
    }

    async midiMA5e(itemNameArray, actor) {
        let count = 0;
        const endCount = itemNameArray.length - 1;
        const itemsArray = [];
        for (let itemName of itemNameArray) itemsArray.push(actor.items.getName(itemName));

        Hooks.on("diceSoNiceRollStart", midiMA5eRollStart);
        Hooks.once("midi-qol.RollComplete", midiMA5eHook);
        itemsArray[0].roll();

        function midiMA5eRollStart(id, context) {
            context.blind = true;
        }

        async function midiMA5eHook() {
            if (count === endCount) {
                return Hooks.off("diceSoNiceRollStart", midiMA5eRollStart)
            };
            Hooks.once("midi-qol.RollComplete", midiMA5eHook);
            count++;
            await new Promise(resolve => setTimeout(resolve, 800));
            return await itemsArray[count].roll();
        }
    }

    buildItemNameArray(html) {
        const itemNameArray = [];
        const items = $(html).find("div.MA5e-multiattack");
        items.each(function () {
            if (!$(this).find(`input[type="checkbox"]`).prop("checked")) return;
            const num = $(this).find(`input[type="number"]`).val();
            for (let i = 0; i < num; i++) itemNameArray.push($(this).prop("id"));
        });

        return itemNameArray;
    }

    getToolDefault(actor) {
        return actor.getFlag("multiattack-5e", "toolDefault");
    }

    setToolDefault(actor, itemNameArray) {
        actor.setFlag("multiattack-5e", "toolDefault", itemNameArray);
    }
}
