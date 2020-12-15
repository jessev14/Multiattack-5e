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
* Smooth Combat
* Better Rolls 5e

*MA5e includes a custom "roller" that can be used to handle multiple rolls (see Demo).
This roller is not compatible with other custom rollers (e.g. Better Rolls 5e) or combat automation modules (e.g. Midi-QOL).

However, this custom roller can be disabled (in the module settings) while maintaining the Multiattack tool in the token layer toolbar.
The Multiattack tool is planned to be as openly compatible as possible, but is not compatible with the core default roller.

Better Rolls 5e is currently compatible, though some additional edits are in progress. Midi-QOL compatibility will tentatively follow.

## Technical Information

The custom MA5e roller overrides:
* Item5e.prototype.rollAttack
* Item5e.prototype.rollDamage

with the following patched helper functions (locally re-defined in patches.js):
#### dnd5e/module/dice.js
* d20Roll
* _d20RollDialog
* damageRoll
* _damageRollDialog
#### dnd5e/module/chat.js
* addChatMessageContextOptions
* applyChatCardDamage

Changes to the above functions in future core/system updates may result in MA5e behaving differently than the rest of the system (or breaking entirely). Some changes are extremely minor, so calls to the original functions may be implemented in a future release to add some protection from the module breaking between updates.

The Multiattack tool by default relies on the custom MA5e roller, but implementation wise, it just calls Item5e.rollAttack / Item5e.rollDamage. This allows the tool to be compatible with other modules that override those functions (as long as the MA5e roller is disabled in settings).

The Multiattack tool dialog window is populated with selected token's owned weapons that have attacks.
If the "Default" checkbox is checked, then on closing of the dialog (either by the close button or by the roll buttons) a flag will be created in the token's actor that will be used to autofill the dialog based on the existing input when the dialog window closes. This flag will be deleted if the checkbox is unchecked.

Since this module was primarily designed for my own use, I intend to keep it and this repository up to date. However, it's a personal rule of mine to not perform any core / system updates until after my next session (currently every other week). I can't guarantee immediate updates, but I believe the update process will be straightforward enough that it should not take more than a few days once I begin.

## Future Implementations 

* ~~Private GM rolls~~ Added in v2.0.0
* ~~Setting to set default number of rolls for attack / damage~~ Added in v2.1.2
* ~~New workflow for attacking with different items in single multiattack action~~ Added in v3.0.0
* ~~Better Rolls 5e compatibility~~ Added in v.3.2.0
* "Damage" button on custom MA5e attack roll chat cards to streamline rolling damage

## Credits and Contact

Endless thanks to everyone in the official Foundry VTT Discord server as well as everyone in The League of Extraordinary FoundryVTT Developers. This project would not exist without all of your help.

Ping me on Discord @enso#0361 if you have any questions, run into any problems/incompatibilities, or have any technical feedback you'd like to throw my way. This is my first module and my first real JavaScript project outside of some macros, so I'm sure there is tons of room for improvement.

## Changelog (see individual releases for full release notes)
### v.3.2.1
* Add setting to enable/disable DSN animations for Multiattack tool with Better Rolls 5e active
### v3.2.0
* Better Rolls 5e compatibility
### v3.1.2
* dnd5e v1.2.0 update
### v3.1.0
* Improved implementation of saving default configuration in Multiattack tool
### v3.0.0
* New Multiattack tool in token layer toolbar that allows for multiple attack rolls of different items to be made at once
### v2.2.0
* Adds styling of Total Damage font to blue.
* Adds support for mixed die type rolls (e.g. 2d10 + 3d6).
* Fixes fast forward rolling (again).
* Lots of under-the-hood clean up of HTML template compiling and rendering.
### v2.1.2
* Adds default rolls functionality
* Fixes fast forward rolling
### v2.0.0
* Adds in Private GM Roll (and other roll mode) functionality for custom multiattack chat cards
### v1.1.1
* Hotfix for a bug in critical damage handling
### v1.0.0
* Initial release
