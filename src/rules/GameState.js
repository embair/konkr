import Players from 'rules/Players';
import Regions from 'rules/Regions';
import Economy from 'rules/Economy';
import Pawns from 'rules/Pawns';
import Actions from 'rules/Actions';
import Warfare from 'rules/Warfare';
import { HexGrid } from 'lib/hexgrid/HexGrid';
import IdGenerator from 'lib/IdGenerator';
import LandGenerator from 'rules/LandGenerator';
import AI from 'ai/AI';

function GameState(spec) {
    let {log} = spec;
    
    let gameStateSpec = spec.extend({
        useName: spec => (moduleName) => {
            return spec.extend({ 
                actions: () => spec.actions && spec.actions.getNamedProxy(moduleName),
                log: () => spec.log && {
                    debug: (...args) => console.debug(`${moduleName}>`, ...args),
                    error: (...args) => console.error(`${moduleName}>`, ...args),
                    warn: (...args) => console.warn(`${moduleName}>`, ...args),
                    log: console.log,
                    info: console.info,
                }
            });
        },
        ids: spec => new IdGenerator(spec),
        grid: spec => new HexGrid(spec),
        pawns: spec => new Pawns(spec.useName('pawns')),
        regions: spec => new Regions(spec.useName('regions')),
        economy: spec => new Economy(spec.useName('economy')),
        actions: spec => new Actions(spec.useName('actions')),
        warfare: spec => new Warfare(spec.useName('warfare')),
        landGen: spec => new LandGenerator(spec.useName('landGen')),
        players: spec => new Players(spec.useName('players')),
        ai: spec => new AI(spec.useName('ai'))
    });
    let {actions, players} = gameStateSpec;

    const self = Object.freeze({
        get spec() { return gameStateSpec; },
        onReset: new Phaser.Signal(),
        toString,
        toDebugString,
        toJSON
    });

    // order is important - modules that rely on objects from other modules must go last
    // for example pawns will want instances of hexes, so they need grid to be loaded
    const STATEFUL_MODULES = ['grid','pawns','regions','economy','players','actions', 'ids'];

    function toJSON() {
        let obj = {};
        STATEFUL_MODULES.forEach(moduleName=> {
            log.debug("Saving "+moduleName);
            obj[moduleName] = gameStateSpec[moduleName].toJSON();
        });
        return obj;
    }

    function fromJSON(jsonData) {
        STATEFUL_MODULES.forEach(moduleName=> {
            log.debug(`Loading ${moduleName} state from`, jsonData[moduleName]);
            gameStateSpec[moduleName].fromJSON(jsonData[moduleName]);
        });
        self.onReset.dispatch();
    }

    actions.setHandler('STORE_STATE', (action, name) => {
        log.debug("Saving current game state...");
        localStorage.setItem(name, JSON.stringify(toJSON()));
        log.info("GameState saved into localStorage["+name+"]");
        action.resolve();
    });

    actions.setHandler('LOAD_STATE', (action, json) => {
        fromJSON(json);
        action.resolve();
    });

    actions.setHandler('START_NEW_GAME',  (action, {worldWidth, worldHeight, numFactions}) => {
        action.schedule('RESET_HEXGRID', worldWidth, worldHeight);
        action.schedule('GENERATE_LANDMASS');
        action.schedule('RANDOMIZE_REGIONS', numFactions);
        action.schedule('SET_INITIAL_TREASURY');
        action.schedule('START_NEW_TURN');
        action.resolve();
    });

    actions.setHandler('START_NEW_TURN', (action) => {
        players.forEach(player => {
            player.regions.forEach(region => action.schedule('COLLECT_REGION_INCOME',region));
            action.schedule('START_PLAYER_TURN', player);
        });
        action.schedule('CHECK_VICTORY_CONDITIONS');
        action.resolve();
    });

    actions.setHandler('CHECK_VICTORY_CONDITIONS', (action)=>{
        // Winning?? No such thing
        action.schedule('START_NEW_TURN');
        action.resolve();
    });

    function toString() {
        return `[GameState]`;
    }

    function toDebugString() {
        return "";
    }

    return self;
}

export default GameState;