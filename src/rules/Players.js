import IterableOn from 'lib/decorators/IterableOn';
import HexGroup from 'lib/hexgrid/HexGroup';

function Players(spec) {

    let { actions, economy, grid, pawns, regions, ids, log, warfare } = spec;

    const _players = [];
    
    let activePlayer = null,
        grabbedPawn = null,
        grabbedPawnRegion = null,
        movedUnits = {};

    class Player {
        constructor(id, name, type) {
            this.id = id;
            this.name = name;
            this.type = type;
        }

        get regions() {
            return getRegionsControlledBy(this);
        }

        controls(region) {
            //cannot compare directly because sublasses don't share 'this'
            return ownerOf(region) && (ownerOf(region).id === this.id);
        }

        canGrabPawn(pawn) {
            return pawn.isTroop() && this.controls(regions.regionOf(pawn.hex)) && !movedUnits[pawn.hex.id];
        }

        canDropPawnAt(hex) {
            if (!grabbedPawn) return false;
            if (regions.regionOf(hex)!=grabbedPawnRegion) return false;
            if (pawns.pawnAt(hex)) {
                return (pawns.getMergeResult(pawns.pawnAt(hex),grabbedPawn));
            } else {
                return true;
            }
        }

        canConquerHex(hex) {
            if (!grabbedPawn || !grabbedPawn.isTroop()) return false;
            if (!grabbedPawnRegion.hexes.neighbours().contains(hex)) {
                log.debug(`Cannot conquer ${hex} as it's not adjacent to the selected region`);
                return false;
            }
            if (warfare.defenseOf(hex) >= grabbedPawn.might) {
                log.debug(`Cannot conquer ${hex} - not enough might`);
                return false;
            }
            return true;
        }

        getAvailableUnits(region) {
            if (!region) {
                return this.regions.reduce(
                    (result,nextRegion)=>result.concat(this.getAvailableUnits(nextRegion)), 
                []);
            }

            let ret = pawns.select({ 
                hexes: region.hexes, 
                custom: pawn=> pawn.isTroop() && this.canGrabPawn(pawn)
            });
            log.debug("available units: ", ret);
            return ret;
        }

        play() { throw Error(`Not implemented`); }

        toString() {
            return `[${this.name} #${this.id}]`;
        }
    }

    // public API
    let self = {
        byId(id) { return _players[id]; },
        ownerOf,
        get activePlayer() { return activePlayer; },
        onGrabbedPawn: new Phaser.Signal(/* pawn */),
        onDroppedPawn: new Phaser.Signal(/* pawnType, hex */),
        onConqueringHex: new Phaser.Signal(/* hex */),
        onBoughtPawn: new Phaser.Signal(/* pawnType, region */),
        get grabbedPawn() { return grabbedPawn; },
        get grabbedRegion() { return grabbedPawnRegion; },
        toDebugString,
        toJSON,
        fromJSON
    };
    IterableOn(self, _players);
    Object.freeze(self);

    function toJSON() {
        return {
            players: _players.filter(x=>x).map(player=>({
                id:player.id,
                name: player.name,
                type: player.type
            })),
            activePlayer: activePlayer && _players.indexOf(activePlayer),
            grabbedPawn: grabbedPawn && grabbedPawn.name,
            grabbedPawnRegion: grabbedPawnRegion && grabbedPawnRegion.id,
            movedUnits: movedUnits
        };
    }

    function fromJSON(src) {
        _players.length = 0;
        src.players.forEach(({type,name,id})=> _players[id]=new createPlayer(type, name, id));
        activePlayer = src.activePlayer && self.byId(src.activePlayer);
        grabbedPawn = src.grabbedPawn && pawns[src.grabbedPawn];
        grabbedPawnRegion = src.grabbedPawnRegion && regions.byId(src.grabbedPawnRegion);
        movedUnits = src.movedUnits;
    }

    function createPlayer(type, name='(unnamed)', id=ids.next('player')) {
        let p;
        switch (type) {
            case 'AI':
                p = new Player(id,name,type);
                p.play = ()=> { actions.schedule("AI_PLAYER_BEGIN", p); };
                break;
            case 'Local':
                p = new Player(id,name,type);
                p.play = ()=> { actions.schedule("AWAIT_PLAYER_INPUT"); };
                break;
            case 'Neutral':
                p = new Player(id,name,type);
                p.play = ()=>{};
                break;
            default:
                throw Error(`Unrecognized player type: ${type}`);
        }
        log.debug(`Created ${p}`);
        return p;

    }

    actions.setHandler('SETUP_PLAYERS', (action, numFactions,playerFaction=0)=> {
        _players.length = 0;
        ids.reset('player');
        for (let i = 1; i<=numFactions; ++i) {
            let newPlayer;
            if (i===playerFaction) {
                newPlayer = createPlayer('Local', 'Human player for faction '+i);
            } else {
                newPlayer = createPlayer('AI', 'AI player for faction '+i);
            }
            _players[newPlayer.id] = newPlayer;
        }
        action.resolve();
    });

    actions.setHandler('START_PLAYER_TURN', (action, player) => {
        if (activePlayer) throw Error(`Cannot start turn for ${player}, because another players turn is in progress: ${activePlayer}`);
        activePlayer = player;
        action.data.previousMovedUnits=movedUnits;
        movedUnits = {};
        player.play();
        action.schedule('END_PLAYER_TURN', player);
        action.resolve();
    },{
        undo(action) {
            movedUnits = action.data.previousMovedUnits;
            activePlayer = null;
        }
    });

    actions.setHandler('CONQUER_HEX', (action, hex) => {
        if (!grabbedPawn) return action.reject(`Attempted to conquer ${hex} with no pawn grabbed!`);
        movedUnits[hex.id] = true;

        if (pawns.pawnAt(hex)) {
            action.schedule('DESTROY_PAWN', pawns.pawnAt(hex));
        }
        action.schedule('CHANGE_HEXES_REGION', new HexGroup(hex), grabbedPawnRegion);
        action.schedule('DROP_UNIT', hex);
        action.resolve();
        self.onConqueringHex.dispatch(grabbedPawn,hex);
    }, { undo(action, hex) {
        delete movedUnits[hex.id];
    }});

    actions.setHandler('GRAB_UNIT', (action, pawn) => {
        if (movedUnits[pawn.hex.id]) throw Error(`Tried to grab ${pawn}, which has already moved this turn.`);
        if (!pawn.pawnType.isTroop()) throw Error(`${pawn} is not movable by player!`);
        const region = regions.regionOf(pawn.hex);
        if (!activePlayer.controls(region)) throw Error(`Tried to grab ${pawn}, which does not belong to ${activePlayer}`);

        self.onGrabbedPawn.dispatch(pawn);
        action.data.previousGrabbed = grabbedPawn;
        addUnitToGrabbed(pawn.pawnType);
        grabbedPawnRegion = region;
        action.schedule('DESTROY_PAWN',pawn);
        action.resolve();
    },{ 
        undo(action) {
            grabbedPawn = action.data.previousGrabbed;
        }
    });

    actions.setHandler('DROP_UNIT', (action, hex) => {
        if (regions.regionOf(hex) != grabbedPawnRegion) throw Error(`Tried to drop pawn into a different region then it originates from.`);
        action.data.grabbedPawn = grabbedPawn;
        action.data.grabbedPawnRegion = grabbedPawnRegion;
        if (pawns.pawnAt(hex)) {
            let newType = pawns.getMergeResult(pawns.pawnAt(hex), grabbedPawn);
            if (!newType) throw Error(`Cannot drop pawn on ${hex} - already occupied by ${pawns.pawnAt(hex)}, merge impossible.`);
            actions.schedule('DESTROY_PAWN', pawns.pawnAt(hex));
            grabbedPawn = newType;
        }
        action.schedule('CREATE_PAWN',grabbedPawn, hex);

        self.onDroppedPawn.dispatch(grabbedPawn,hex);
        grabbedPawn = null;
        grabbedPawnRegion = null;
        action.resolve();
    }, { undo(action) {
        grabbedPawn = action.data.grabbedPawn;
        grabbedPawnRegion = action.data.grabbedPawnRegion;
    }});

    actions.setHandler('BUY_UNIT', (action, unitType, region)=> {
        const cost = economy.priceOf(unitType);
        if (!cost) throw Error(`Unit ${unitType} cannot be bought by a player.`);
        if (!region) throw Error(`No region specified, who is supposed to pay for this?!`);
        if (cost > economy.treasuryOf(region)) throw Error(`Region ${region} cannot afford to buy ${unitType}.`);
        action.schedule('ADJUST_REGION_TREASURY',region, -cost);
        addUnitToGrabbed(unitType);
        grabbedPawnRegion = region;
        self.onBoughtPawn.dispatch(unitType, region);
        action.resolve();
    },{
        undo() {
            grabbedPawn=null;
            grabbedPawnRegion=null;
        }
    });

    actions.setHandler('END_PLAYER_TURN', (action, player) => {
        if (player!=activePlayer)  throw Error(`${player} requested to end his turn but it's not his turn currently!`);
        if (grabbedPawn) throw Error(`${player} tried to end turn with an unplaced pawn still grabbed.`);
        activePlayer = null;
        action.resolve();
    },{ undo(action, player) {
        activePlayer = player;
    } });

    // when the current region was merged into another one, make sure to update
    // grabbedPawnRegion with the new region identity
    regions.onMerged.add((srcRegion, rcvRegion)=>{
        if (grabbedPawnRegion === srcRegion) grabbedPawnRegion = rcvRegion;
    });

    function addUnitToGrabbed(pawnType) {
        if (grabbedPawn) {
            let result = pawns.getMergeResult(grabbedPawn, pawnType);
            if (!result) throw Error(`Illegal attempt to merge ${grabbedPawn} with ${pawnType}`);
            grabbedPawn = result;
        } else {
            grabbedPawn = pawnType;
        }
    }

    function toDebugString() {
        return `
ActivePlayer: ${activePlayer}
MovedUnits: ${Object.keys(movedUnits).map(hex=>hex.toString()).join(', ')}
Grabbed: ${(grabbedPawn ? `${grabbedPawn} (owned by ${grabbedPawnRegion})` : '(nothing)')}

Players:
${_players.filter(x=>x).map(p=>` * ${p}`).join('\n')}
`;
    }

    function getRegionsControlledBy(player) {
        return regions.filter(r=>ownerOf(r) === player);
    }

    function ownerOf(region) {
        //TODO less bullshit, more actual implementation
        return _players[region.faction];
    }

    return Object.freeze(self);
}

export default Players;