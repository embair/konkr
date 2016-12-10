import { PawnType } from 'rules/Pawns';
import { signedNumber } from 'lib/util';

const PAWN_UPKEEP = new Map([
    [PawnType.TROOP_1, 2],
    [PawnType.TROOP_2, 6],
    [PawnType.TROOP_3, 18],
    [PawnType.TROOP_4, 64],
    [PawnType.UNREST, 1],
    [PawnType.RAIDERS, 1],
    [PawnType.GRAVE, 1]
]);

const PAWN_PURCHASE_COST = new Map([
    [PawnType.TROOP_1, 10],
    [PawnType.TROOP_2, 20],
    [PawnType.TROOP_3, 30],
    [PawnType.TROOP_4, 40],
    [PawnType.TOWER, 15],
]);

function Economy(spec) {
    let {log, pawns, actions, regions} = spec;

    let regionTreasury = new WeakMap();

    const self = Object.freeze({
        costOfPawnType,
        netIncomeOf,
        incomeOf,
        treasuryOf,
        expensesOf,
        upkeepOfPawn,
        onRegionTreasuryChanged: new Phaser.Signal(/* region, newValue, oldValue */),
        onRegionBankrupt: new Phaser.Signal(/* region */),
        toDebugString
    });

    /// ACTION HANDLERS

    actions.setHandler('BUY_UNIT', (action, unitType, hex)=> {
        const cost = PAWN_PURCHASE_COST.get(unitType);
        if (!cost) return action.reject(`Unit ${unitType} cannot be bought by a player.`);
        if (cost > treasuryOf(regions.regionOf(hex))) return action.reject(`Region ${regions.regionOf(hex)} cannot afford to buy ${unitType}.`);

        action.schedule('CHANGE_REGION_TREASURY',regions.regionOf(hex), -PAWN_PURCHASE_COST.get(unitType));
        action.schedule('CREATE_PAWN',unitType,hex);
        action.resolve();
    });

    actions.setHandler('CHANGE_REGION_TREASURY', (action, region, amount) => {
        setTreasuryOf(region,treasuryOf(region) + amount);
        action.resolve();
    });

    actions.setHandler('SET_INITIAL_TREASURY', action => {
        regions.forEach(region=>{
            setTreasuryOf(region,netIncomeOf(region)*5);
        });
        action.resolve();
    });    

    actions.setHandler('SET_REGION_TREASURY', (action, region, amount) => {
        setTreasuryOf(region,amount);
        action.resolve();
    });

    actions.setHandler('UPDATE_ECONOMY', (action,player)=>{
        player.controlledRegions.forEach( (region) => {
            const oldValue = treasuryOf(region) || 0;
            let newValue = oldValue + netIncomeOf(region);
            if (newValue < 0) {
                newValue = 0;
                self.onRegionBankrupt.dispatch(region);
                actions.schedule('KILL_TROOPS_IN_REGION', region);
            }
            setTreasuryOf(region, newValue);
        });
        action.resolve();
    });

    /// ACTION TRIGGERS

    regions.onLostCapital.add(region=>{
        actions.schedule('SET_REGION_TREASURY',region,0);
    });

    regions.onGainedCapital.add(region=>{
        actions.schedule('SET_REGION_TREASURY',region,0);
    });

    // PUBLIC METHODS

    function toDebugString() {
        return regions.map(region => {
            if (region.hasCapital()) return `* ${region.id}: ${treasuryOf(region) || 'N/A'} (${signedNumber(netIncomeOf(region))})`;
        }).filter(x=>x).join('\n');
    }

    function netIncomeOf(region) {
        return incomeOf(region) - expensesOf(region);
    }

    function costOfPawnType(pawnType) {
        return PAWN_PURCHASE_COST.get(pawnType) || 0;
    }

    function incomeOf(region) {
        if (!region.hasCapital()) return 0;
        return region.hexes.length;
    }

    function expensesOf(region) {
        if (!region.hasCapital()) return 0;
        let sum = 0;
        region.hexes.forEach((hex) => {
            sum += upkeepOfPawn(pawns.pawnAt(hex));
        });
        return sum;
    }

    function treasuryOf(region) {
        return regionTreasury.get(region) || 0;
    }

    function upkeepOfPawn(pawn) {
        if (!pawn) return 0;
        return PAWN_UPKEEP.get(pawn.pawnType) || 0;
    }

    // PRIVATE METHODS

    function setTreasuryOf(region,value) {
        const oldValue = treasuryOf(region);
        if (value === oldValue) return;
        regionTreasury.set(region,value);
        self.onRegionTreasuryChanged.dispatch(region, value, oldValue);
    }


    return self;
}

export default Economy;