import UI from 'lib/controls/UI';
import { assertDefined } from 'lib/util';

function RegionPanel(spec) {
    let { log, debug, game, economy, ui, regions, players, pawns } = spec;

    let group = null,
        currentRegion = null;

    let controls = new UI(spec,{
        name: 'mainContainer',
        component: 'image',
        src: 'regionPanel',
        align:Phaser.BOTTOM_CENTER,
        contains: [
            {
                name: 'pawnShop',
                component: 'pawnShop',
                align: Phaser.BOTTOM_CENTER,
                vOffset: -32,
            },
            {
                name: 'stats',
                component: 'horizontalGroup',
                align: Phaser.BOTTOM_CENTER,
                spacing: 3,
                contains: [
                    {
                        name: 'goldIcon',
                        component: 'image',
                        src: 'goldCoins',
                        align: Phaser.BOTTOM_CENTER,
                        vOffset: -8,
                    },
                    {
                        name: 'treasuryLabel',
                        style: { font: "20pt Bookman Old Style", fill: "black"},
                        component: 'label',
                        align: Phaser.BOTTOM_CENTER,
                    },
                    {
                        name: 'incomeLabel',
                        style: { font: "10pt Bookman Old Style", fill: "black"},
                        component: 'label',
                        align: Phaser.BOTTOM_CENTER,
                        vOffset: -4,
                    },

                ]
            }
        ]
    });

    let { 
        stats,
        mainContainer, 
        treasuryLabel,
        incomeLabel,
        pawnShop,
        goldIcon
    } = controls;

    assertDefined(mainContainer, treasuryLabel, incomeLabel);
    group = mainContainer;

//    debug.sprite(stats);
//    debug.sprite(treasuryLabel);
//    debug.sprite(incomeLabel);
//    debug.sprite(goldIcon);

    ui.onRegionSelected.add(region => {
        setRegion(region);
    });

    regions.onChanged.add(refreshIfMatchingCurrentRegion);
    economy.onRegionTreasuryChanged.add(refreshIfMatchingCurrentRegion);
    /*players.onDroppedPawn.add((pawnType, hex)=>{
        if (regions.regionOf(hex) === currentRegion) synchronize();
    });*/
    /*players.onGrabbedPawn.add(()=> {
       if (players.grabbedPawnRegion === currentRegion) synchronize();
    });*/
    players.onBoughtPawn.add((pawnType, region)=> {
        refreshIfMatchingCurrentRegion(region);
    });
    pawns.onCreated.add(pawn=> {
        refreshIfMatchingCurrentRegion(regions.regionOf(pawn.hex));
    });
    pawns.onDestroyed.add(pawn=> {
        refreshIfMatchingCurrentRegion(regions.regionOf(pawn.hex));
    });

    return Object.freeze({
        get group() { return group; },
        synchronize        
    });


    function refreshIfMatchingCurrentRegion(region) {
        if(region === currentRegion) synchronize();
    }


    function accountingColor(number) {
        if (number > 0) return "#00aa00";
        if (number < 0) return "#aa0000";
        return "#000000";
    }

    function synchronize() {
        setRegion(ui.selectedRegion);
    }

    function setRegion(region) {
        currentRegion = region;
        if (!region) {
            mainContainer.hide();
        } else {
            //regionNameLabel.text = `#${region.id}`;
            const treasury = economy.treasuryOf(region);
            let netIncome = economy.netIncomeOf(region);
            if (players.grabbedPawn) netIncome -= (players.grabbedPawn.upkeep || 0);
            const incomeColor = accountingColor(netIncome);
            netIncome = (netIncome>=0?'+':'')+netIncome;

            treasuryLabel.text = treasury;
            incomeLabel.text = netIncome;
            incomeLabel.addColor(incomeColor, 0);
            pawnShop.setStock(economy.buyablePawns(region));
            mainContainer.show();
        }
    }
}

export default RegionPanel;