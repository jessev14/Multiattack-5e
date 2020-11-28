![All Downloads](https://img.shields.io/github/downloads/jessev14/Multiattack-5e/total?style=for-the-badge)

# Multiattack 5e

Multiattack 5e (MA5e) is a FoundryVTT module for the DnD5e system that streamlines the multiattack action.
Users can perform several attack / damage rolls at once, and the output is condensed into a custom chat card.

## Usage

### Without MA5e 

<img src="/img/default.gif" width="295" height="667"/>

### With MA5e
<img src="/img/package-preview.png" width="295" height="667"/>

## Instructions

* Install the module and activate as with any other module. Manifest URL: https://github.com/jessev14/multiattack-5e/releases/latest/download/module.json

* An additional input is added to the Attack and Damage dialog boxes
* Select the number of attacks or hits to roll
* Click the appropriate roll button
* Total damage of multiple damage rolls can be applied to selected tokens

## Incompatibilities

* Midi-QOL
* Smooth Combat
* Better Rolls 5e (if you're using BR, you probably don't need this module)

MA5e was not designed to be used with any major combat automation modules. Therefore, Midi-QOL and Smooth Combat are not expected to be compatible as is.

See Technical Information for details regarding implementation for possible ideas on how to extend compatibility.

## Technical Information

MA5e works by overriding these functions in an 'ready' hook callback:
* Item5e.prototype.rollAttack
* Item5e.prototype.rollDamage

In addition, the following functions are used:
#### dnd5e/module/dice.js
* d20Roll
* _d20RollDialog
* damageRoll
* _damageRollDialog
#### dnd5e/module/chat.js
* addChatMessageContextOptions
* applyChatCardDamage

All above functions are copy + pasted from their respective sources.
They are then edited (including function name) to produce the MA5e features. As such, changes to the above functions in future updates may result in MA5e behaving differently than the rest of the system (or breaking entirely).

Some changes to the above functions are extremely minor, so calls to the original functions may be implemented in a future release to add some protection from the module breaking between updates.

Since this module was primarily designed for my own use, I intend to keep it and this repository up to date. However, it's a personal rule of mine to not perform any core / system updates until after my next session (currently every other week). I can't guarantee immediate updates, but I believe the update process will be straightforward enough that it should not take more than a few days once I begin.

## Future Implementations 

* ~~Private GM rolls (highest priority)~~ Added in v2.0.0
* ~~Setting to set default number of rolls for attack / damage~~ Added in v2.1.2
* New workflow for attacking with different items in single multiattack action
* Localization with il18n (low priority; very few new strings)
* ~~Setting to allow each individual damage roll to be applied separately, instead of only applying the total~~ Concept scrapped. Submit an issue if this feature is desired.

## Credits and Contact

Big thanks to @danielrab#7070 on the Foundry Discord channel for answering a bunch of my questions when I was starting out.

Ping me on Discord @enso#0361 if you have any questions, run into any problems/incompatibilities, or have any technical feedback you'd like to throw my way. This is my first module and my first real JavaScript project outside of some macros, so I'm sure there are tons of areas for possible improvement.

## Changelog
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
