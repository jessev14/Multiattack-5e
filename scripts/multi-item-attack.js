/*

(async () => { // for testing as a macro -jv
    const template = "modules/multiattack-5e/templates/MA5e-multi-item-dialog.html";
    const weapons = token.actor.items.filter(i => i.hasAttack);
    const dialogContent = await renderTemplate(template, { weapons: weapons });

    console.log(weapons);

    new Dialog({
        title: "Multiattack",
        content: dialogContent,
        buttons: {
            rollMA: {
                label: "Roll Multiattack",
                callback: (html) => {
                    rollMA(html);
                }
            }
        }
    }).render(true);
})();


async function rollMA(html) {

};

*/