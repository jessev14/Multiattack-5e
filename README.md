![All Downloads](https://img.shields.io/github/downloads/jessev14/Multiattack-5e/total?style=for-the-badge)

# Multiattack 5e

Multiattack 5e (MA5e) is a FoundryVTT module for the DnD5e system that streamlines the multiattack action.
Users can perform several attack / damage rolls at once, and the output is condensed into a custom chat card.

## Demo

### Default (left) vs MA5e (right)
<img src="/img/default.gif" width="295" height="667"/> <img src="/img/package-preview.png" width="295" height="667"/>

### Multiattack Tool
<img src="/img/tool-preview.png" width="590">


## Instructions

### MA5e roller:
* Roll the weapon item as normal (create the item chat card in the chat log)
* Select Attack / Damage on the chat card
* An additional input is added to the Attack and Damage dialog boxes
* Select the number of attacks or hits to roll
* Optional: Check the "Default" checkbox to save the number of rolls for subsequent attacks (compatible with fast forward rolling)
* Click the appropriate roll button

### Multiattack tool:
* (For GMs) select a single token
* Click the Multiattack tool button in the token layer toolbar on the left
* Check each item to be included in the roll and input how many of that item's attack/damage to roll (default 1)
* Optional: Check the "Default" checkbox to save the entire multiattack roll configuration for subsequent attacks
* Click the approprate roll button

## Incompatibilities*

* Midi-QOL
* Better Rolls for 5e
* Mars 5e - Moerills alternative rolling style
* Smooth Combat

*MA5e includes a custom "roller" that can be used to handle multiple rolls (see Demo).
This roller is not compatible with other custom rollers (e.g. Better Rolls 5e) or combat automation modules (e.g. Midi-QOL).

However, this custom roller can be disabled (in the module settings) while maintaining the Multiattack Tool in the token layer toolbar. The Multiattack Tool is planned to be as openly compatible as possible, but is not compatible with the core default roller.

Better Rolls 5e is currently compatible and basic Midi-QOL compatibility is implemented, though still requires some testing and fine tuning. Mars 5e will be considered after implementing Midi-QOL compatibility.

## Technical Information

### MA5e Custom Roller

The custom MA5e roller overrides:
#### dnd5e/module/item/entity.js
* Item5e.prototype.rollAttack
* Item5e.prototype.rollDamage

with the following patched helper functions (locally re-defined in override.js):
#### dnd5e/module/dice.js
* d20Roll
* _d20RollDialog
* damageRoll
* _damageRollDialog
#### dnd5e/module/chat.js
* addChatMessageContextOptions
* applyChatCardDamage

The overriden functions are copy and pasted directly from entity.js and are only there to redirect the helper function calls to the locally-defined patched versions in override.js.

d20Roll and damageRoll are patched to implement new rolling logic which can handle performing and returning an array of multiple rolls rather than just a single roll.

_d20RollDialog and _damageRollDialog are only changed to use the custom template that includes an additional select element to indicate the number of rolls to make. Ideally, patching these private methods could be avoided by just patching the HTML template they point to by default, but I have not yet been able to figure out the logistics of this approach (i.e. how to override the HTML template).

### Multiattack Tool

The Multiattack Tool is basically just a heavy duty macro that prompts the user to select the weapons to roll and input how many times to roll each weapon. The dialog box is automatically populated from the selected actor's weapon items that have attacks. Default selections can be saved/cleared via buttons on the dialog that set/unset a flag on the actor.

#### MA5e Custom Roller
The selected weapons are rolled using different logic based on whether certain modules are active. If neither Better Rolls 5e nor Midi-QOL are active, then the custom roller described above is used; basically just calling Item5e.rollAttack / Item5e.rollDamage in a loop. The rolls data are collected behind the scenes and used to generate a custom chat card.

#### Better Rolls for 5e
If Better Rolls for 5e is active, then the Multiattack Tool uses the Better Rolls custom roller to roll the weapons; basically just calling BetterRolls.quickRollById in a loop. It may be possible to collect the rolls data and generate a custom chat card for these rolls as well, but in my opinion, Better Rolls 5e already does a fantastic job of streamlining roll information so I don't feel that this is necessary. However, feel free to submit an issue if you feel otherwise.

#### Midi-QOL
If Midi-QOL is active, then the Multiattack Tool performs an initial item roll using the first item in the Multiattack Roll. Prior to this inital roll, MA5e creates a hook on "midi-qol.RollComplete" with an anonymous callback function that rolls the next item. The hook is (supposedly) called at the end of a Midi-QOL workflow, and so essentially the next item roll is not initiated until the previous once is completed. Once all items are rolled (determined by an incrementing counter), the hook is removed.

### Dice So Nice!

Since the number of rolls being made could be quite large, there are world-scope settings that allow for GM users to enable/disable DSN animations. If using the MA5e custom roller, DSN animations can be enabled/disabled for attack rolls or damage rolls or both. This can be set independently for rolls made using the attack/damage chat card buttons or with the Multiattack Tool.

For Better Rolls 5e users, since attack and damage rolls are made simultaneously, the only option is to enable or disable DSN animations entirely (for rolls made using the Multiattack Tool only; other rolls are not effected).

## Future Implementations 

* ~~Private GM rolls~~ Added in v2.0.0
* ~~Setting to set default number of rolls for attack / damage~~ Added in v2.1.2
* ~~New workflow for attacking with different items in single multiattack action~~ Added in v3.0.0
* ~~Better Rolls 5e compatibility~~ Added in v.3.2.0
* ~~Midi-QOL compatibility~~ Added in v4.2.0
* "Damage" button on custom MA5e attack roll chat cards to streamline rolling damage

## Credits and Contact

Endless thanks to everyone in the official Foundry VTT Discord server as well as everyone in The League of Extraordinary FoundryVTT Developers. This project would not exist without all of your help.

Ping me on Discord @enso#0361 if you have any questions, run into any problems/incompatibilities, or have any technical feedback you'd like to throw my way. This is my first module and my first real JavaScript project outside of some macros, so I'm sure there is tons of room for improvement.

## Changelog (see individual releases for full release notes)