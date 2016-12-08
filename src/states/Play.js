import { HexGrid } from 'lib/HexGrid';
import * as Renderer from 'ui/Renderer';
import HexSelectionProxy from 'ui/HexSelectionProxy';
import LandGenerator from 'rules/LandGenerator';
import Injector from 'lib/Injector';
import Scrolling from 'ui/Scrolling';
import RegionPanel from 'ui/RegionPanel';
import GridOverlays from 'ui/GridOverlays';
import UI from 'lib/controls/UI';

import GameDirector from 'rules/GameDirector';
import Players from 'rules/Players';
import Regions from 'rules/Regions';
import Economy from 'rules/Economy';
import { Pawns } from 'rules/Pawns';
import Actions from 'rules/Actions';
import Warfare from 'rules/Warfare';

function Play(game) { 

    let log = console;
    let gameSpec = null,
        gameUi = null,
        debugTabName='actions',
        lastDebugContent='';


    return Object.freeze({
        init,
        preload,
        create,
        update,
        render,
        toString:()=>"[State Play]"
    });

    function init(spec) {

        gameSpec = new spec.extend({
            // returns a modified clone of spec which has some modules customized for the specified name
            usingName: spec => (moduleName) => {
                return spec.extend({ 
                    actions: () => spec.actions && spec.actions.getNamedProxy(moduleName),
                    log: () => spec.log && {
                        debug: (...args) => console.debug(`${moduleName}>`, ...args),
                        error: (...args) => console.error(`${moduleName}>`, ...args),
                        warn: (...args) => console.warn(`${moduleName}>`, ...args),
                        log: (...args) => console.log(`${moduleName}>`, ...args),
                        info: (...args) => console.info(`${moduleName}>`, ...args),
                    }
                });
            },
            debug: spec => new Renderer.DebugInfo(spec),
            grid: () => new HexGrid(),
            pawns: spec => new Pawns(spec.usingName('pawns')),
            regions: spec => new Regions(spec.usingName('regions')),
            economy: spec => new Economy(spec.usingName('economy')),
            actions: spec => new Actions(spec.usingName('actions')),
            warfare: spec => new Warfare(spec.usingName('warfare')),
            landGen: spec => new LandGenerator(spec.usingName('landGen')),
            gameDirector: spec => new GameDirector(spec.usingName('gameDirector')),
            players: spec => new Players(spec.usingName('players')),
        });

        gameUi = gameSpec.extend({
            landSprites: spec => new Renderer.LandSprites(spec),
            pawnSprites: spec => new Renderer.Pawns(spec),
            hexSelectionProxy: spec => new HexSelectionProxy(spec),
            scrolling: spec => new Scrolling(spec),
            uiRegionPanel: spec => new RegionPanel(spec.usingName('uiRegionPanel')),
            gridOverlays: spec => new GridOverlays(spec),
        });
        log = spec.log;
        window.c = gameUi;
    }

    function create() {
        game.world.setBounds(0, 0, 3000, 3000);

        //display layers z-order
        game.world.add(gameUi.landSprites.group);          
        game.world.add(gameUi.gridOverlays.group);  
        game.world.add(gameUi.pawnSprites.group);          
        game.world.add(gameUi.hexSelectionProxy.group);
        game.world.add(gameUi.uiRegionPanel.group);  
        game.stage.backgroundColor='#d5dfef';

        // Keyboard shortcuts
/*        var kEnter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
        kEnter.onDown.add(function() {director.commitWord(); });
*/
        gameUi.gridOverlays.configureOverlay({
            name: 'defense',
            func: (hex) => { return gameSpec.warfare.defenseOf(hex)/5; }
        });
        gameUi.gridOverlays.show('defense');

        game.canvas.oncontextmenu = function (e) { 
            e.preventDefault(); 
            gameUi.gridOverlays.group.visible = !gameUi.gridOverlays.group.visible;
        };

        let { nextTurnButton } = new UI(gameSpec,{
            name: 'nextTurnButton',
            component: 'button',
            sprite: 'nextTurnButton',
            hAlign: 'right',
            vAlign: 'bottom',
            hOffset: 10,
            vOffset: 10,
        });

        let nextStateCallback = null;

        gameSpec.actions.addHandler('UPDATE_ECONOMY', (callback) => {
            nextStateCallback = callback;
        }, 'Manual confirmation');
        gameSpec.actions.addHandler('PLAYER_ACT', (callback) => {
            nextStateCallback = callback;
        }, 'Manual confirmation');

        gameSpec.actions.addHandler('RESET_WORLD', (callback, width, height) => {
            gameSpec.grid.reset(width, height);
            callback();
        }, 'Reset grid');

        nextTurnButton.addToGroup(game.world);
        nextTurnButton.onInputUp.add(() => {
            if (nextStateCallback) {
                nextStateCallback();
                nextStateCallback = null;
            }
        });

        game.debug.reset();

        setupDebugDiv();
        gameSpec.actions.checkHandlers();
        gameSpec.gameDirector.begin({
            worldWidth: 30,
            worldHeight: 30,
        });

        log.info("Level initialization complete.");
    }

    function setupDebugDiv() {
        const debugDiv = document.getElementById("debug");
        const debugSelect = document.getElementById("debugModeSelect");

        if (!debugDiv) return;
        debugSelect.innerHTML= gameUi.listConstructors().sort().map(key => (gameUi[key].toDebugString?`<option value='${key}'>${key}</option>`:''));
        debugSelect.value = debugTabName;
        debugSelect.onchange = () => { refreshDebugTab(debugSelect.value); };
        setInterval(refreshDebugTab, 100);
    }

    function refreshDebugTab(name = debugTabName) {
        debugTabName=name;
        const newContent = `<pre>${gameUi[name].toDebugString()}</pre>`;
        if (newContent == lastDebugContent) return;
        lastDebugContent = newContent;
        document.getElementById("debugContent").innerHTML = newContent; 
    }

    function preload() {
        game.time.advancedTiming = true;
        game.time.desiredFps = 120;
    }

    function update() {
        gameUi.scrolling.update();
    }

    function render() {
    }
}

export default Play;