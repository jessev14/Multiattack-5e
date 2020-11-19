![All Downloads](https://img.shields.io/github/downloads/jessev14/Multiattack-5e/total?style=for-the-badge)

# Multiattack 5e

Mulitattack 5e (MA5e) is a FoundryVTT module for the DnD5e system that streamlines the multiattack action.
Users can perform several attack / damage rolls at once, and the output is condensed into a custom chat card.

## Usage

### Without MA5e 

<img src="/img/default.gif" width="291" height="588"/>

### With MA5e
<img src="/img/package-preview.png" width="291" height="588"/>

## Instructions

* Install the module and activate as with any other module. Manifest URL: https://github.com/jessev14/multiattack-5e/releases/latest/download/module.json

* An additional input is added to the Attack and Damage dialog boxes
* Select the number of attacks or hits to roll
* Click the appropriate roll button
* Total damage of multiple damage rolls can be applied to selected tokens

## Incompatibilities

* Midi-QOL
* Smooth Combat

MA5e was not designed to be used with any major combat automation modules. Therefore, Midi-QOL and Smooth Combat are not expected to be compatible as is.

See Technical Information for details regarding implementation for possible ideas on how to extend compatibility.

## Limitations

As of v1.0.0, all custom multiattack chat cards are publically viewable.
Allowing Private GM multiattack rolls is the focus of the next major version release.

For rolls with formulas that contain more than one die type (e.g. 1d10 + 1d6), chat cards may not render completely accurately.
This could be addressed, but the added complexity could make the module more susceptible to drastically breaking between updates. In addition, most damage formulas seem to only rely on one die type (e.g. 4d6).
If there is significant desire for this feature, it can be added.

## Technical Information

MA5e works by overriding these functions:
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

All above functions are copy + pasted into a "ready" hook callback.
They are then edited (including function name) to produce the MA5e features. As such, changes to the above functions in future updates may result in MA5e behaving differently than the rest of the system (or breaking entirely).

Some changes to the above functions are extremely minor, so calls to the original functions may be implemented in a future release to add some protection from the module breaking between updates.

Since this module was primarily designed for my own use, I intend to keep it and this repository up to date. However, it's a personal rule of mine to not perform any core / system updates until after my next session (currently every other week). I can't guarantee immediate updates, but I believe the update process will be straightforward enough that it should not take more than a few days once I begin.

## Future Implementations 

* Private GM rolls (highest priority)
* Setting to set default number of rolls for attack / damage
* Setting to allow each individual damage roll to be applied separately, instead of only applying the total
* Localization with il18n (lowest priority; very few new strings)

## Credits and Contact

Big thanks to @danielrab#7070 on the Foundry Discord channel for answering a bunch of my questions when I was starting out.

Ping me on Discord @enso#0361 if you have any questions, run into any problems/incompatibilities, or have any technical feedback you'd like to throw my way. This is my first module and my first real JavaScript project outside of some macros, so I'm sure there are tons of areas for possible improvement.
