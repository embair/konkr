import { HexGrid } from 'lib/HexGrid';
import * as Renderer from 'ui/Renderer';
import HexSelectionProxy from 'ui/HexSelectionProxy';
import { worldGenPerlin, worldGenSolid } from 'rules/WorldGenerator';
import Injector from 'lib/Injector';
import Scrolling from 'ui/Scrolling';
import RegionPanel from 'ui/RegionPanel';
import GridOverlays from 'ui/GridOverlays';

import Regions from 'rules/Regions';
import Economy from 'rules/Economy';
import { Pawns } from 'rules/Pawns';
import Actions from 'rules/Actions';
import Warfare from 'rules/Warfare';

function Play(game) { 

    let log = console;
    let gameSpec = null;

    return Object.freeze({
        init,
        preload,
        create,
        update,
        render,
    });

    function init(spec) {
        console.debug("init");
        gameSpec = new Injector(spec);
        gameSpec.registerAll({
            debug: spec => new Renderer.DebugInfo(spec),
            grid: () => new HexGrid(40,40),
            pawns: spec => new Pawns(spec),
            regions: spec => new Regions(spec),
            economy: spec => new Economy(spec),
            actions: spec => new Actions(spec),
            warfare: spec => new Warfare(spec),

            landSprites: spec => new Renderer.LandSprites(spec),
            pawnSprites: spec => new Renderer.Pawns(spec),
            generateWorld: () => worldGenPerlin,
            hexSelectionProxy: spec => new HexSelectionProxy(spec),
            scrolling: spec => new Scrolling(spec),
            uiRegionPanel: spec => new RegionPanel(spec),
            gridOverlays: spec => new GridOverlays(spec),
        });
        log = spec.log;
        window.spec = gameSpec;
    }

    function create() {
        console.debug("create");

        gameSpec.generateWorld(gameSpec);
        gameSpec.regions.randomize();
        game.world.setBounds(0, 0, 3000, 3000);


        //display layers z-order
        game.world.add(gameSpec.landSprites.group);          
        game.world.add(gameSpec.gridOverlays.group);  
        game.world.add(gameSpec.pawnSprites.group);          
        game.world.add(gameSpec.hexSelectionProxy.group);
        game.world.add(gameSpec.uiRegionPanel.group);  
        // A simple background    
        /*
        var bg = g.staticBackground.create(0, 0, CFG.world.background);
        bg.width = game.width;
        bg.scale.y = bg.scale.x;
        bg.y=game.world.height-120-bg.height;*/
        //bg.height = game.world.height;

        game.stage.backgroundColor='#d5dfef';

        // Keyboard shortcuts
/*        var kEnter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
        kEnter.onDown.add(function() {director.commitWord(); });
*/
        log.info("Level initialization complete.");

        gameSpec.gridOverlays.configureOverlay({
            name: 'defense',
            func: (hex) => { return gameSpec.warfare.defenseOf(hex)/5; }
        });
        gameSpec.gridOverlays.show('defense');
        gameSpec.actions.execute('NEXT_TURN');
        game.canvas.oncontextmenu = function (e) { 
            e.preventDefault(); 
            gameSpec.gridOverlays.group.visible = !gameSpec.gridOverlays.group.visible;
        };
        game.debug.reset();
    }

    function preload() {
        game.time.advancedTiming = true;
        game.time.desiredFps = 120;
    }

    function update() {
        gameSpec.scrolling.update();
    }

    function render() {
    }
}

export default Play;