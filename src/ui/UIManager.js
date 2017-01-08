import * as Renderer from './Renderer';
import HexSelectionProxy from './HexSelectionProxy';
import Scrolling from './Scrolling';
import RegionPanel from './RegionPanel';
import GridOverlays from './GridOverlays';
import Messages from './Messages';
import PawnSprites from './PawnSprites';
import NextTurnButton from './NextTurnButton';
import TweenManager from './TweenManager';
import { extend, debounce } from 'lib/util';
import Scene from './scene/Scene';
import SFX from './SFX';
import OptionButtons from './OptionButtons';
import ModalsManager from './ModalsManager';

function UIManager(spec) {
    
    const {game, regions, gameState, actions, players, grid} = spec;
        
    let selectedRegion,
        selectedHex,
        scene,
        resumeActionsCallback, // stored callback for pending AWAIT_PLAYER_INPUT action
        defaultSpectatorScene = 'FAST_SPECTATING';

    let self = Object.freeze({
        onHexSelected: new Phaser.Signal(/* hex */),
        onRegionSelected: new Phaser.Signal(/* region */),
        onSelectedRegionChanged: new Phaser.Signal(/* region */),
        onResize: new Phaser.Signal(),
        get uiSpec() { return uiElements; },
        get scene() { return scene },
        get selectedRegion() { return selectedRegion; },
        get selectedHex() { return selectedHex; },
        changeScene,
        reloadScene,
        changeSceneNow,
        selectHex,
        selectRegion,
        buyPawn, //(pawnType)
        endTurn,
        render,
        update,
        undo,
        showRestartMenu,
        processActions,
        toDebugString
    });

    const { log } = spec.useName('ui');

    let uiElements = spec.extend({
        useName: spec => (moduleName, logLevel) => {
            return spec.extend({ 
                actions: () => spec.actions && spec.actions.getNamedProxy(moduleName),
                debug: () => spec.debug && spec.debug.getNamedProxy(moduleName),
                log: () => {
                    if (!spec.log) return undefined;
                    let logger = spec.log.getLogger(moduleName);
                    if (logLevel!==undefined) logger.setLevel(logLevel);
                    return logger;
                }
            });
        },
        landSprites: spec => new Renderer.LandSprites(spec.useName('landSprites')),
        regionBorders: spec => new Renderer.RegionBorders(spec.useName('regionBorders')),
        conquerableHexesHighlight: spec => new Renderer.ConquerableHexesHighlight(spec.useName('conquerableHexesHighlight')),
        selRegionHighlight: spec => new Renderer.SelectedRegionHighlight(spec),
        pawnSprites: spec => new PawnSprites(spec.useName('pawnSprites')),
        hexSelectionProxy: spec => new HexSelectionProxy(spec),
        scrolling: spec => new Scrolling(spec),
        uiRegionPanel: spec => new RegionPanel(spec.useName('regionPanel', log.levels.INFO)),
        gridOverlays: spec => new GridOverlays(spec),
        messages: spec => new Messages(spec),
        nextTurnButton: spec => new NextTurnButton(spec.useName('nextTurnButton', log.levels.INFO)),
        tweens: spec => new TweenManager(spec),
        grabbedPawn: spec => new Renderer.GrabbedPawn(spec),
        feedbackSymbols: spec => new Renderer.FeedbackSymbols(spec),
        optionButtons: spec => new OptionButtons(spec.useName('optionButtons', log.levels.INFO)),
        sfx: spec=> new SFX(spec),
        modals: spec => new ModalsManager(spec),
        ui: () => self
    });


    //display layers z-order
    const Z_ORDER = [
        'landSprites',
        'regionBorders',
        'conquerableHexesHighlight',
        'selRegionHighlight',
        'pawnSprites',
        'gridOverlays',
        'hexSelectionProxy',
        'messages',
        'uiRegionPanel',
        'nextTurnButton',
        'grabbedPawn',
        'feedbackSymbols',
        'optionButtons',
    ];
    Z_ORDER.forEach(e => game.world.add(uiElements[e].group));
    game.world.add(uiElements.modals.group);

    let scenes = {
        'FAST_SPECTATING': new Scene.FastSpectating(uiElements),
        'INSTANT_SPECTATING': new Scene.InstantSpectating(uiElements),
        'PLAYER_TURN': new Scene.LocalPlayerTurn(uiElements),
        'DEBUG': new Scene.Debug(uiElements)
    };

    regions.onChanged.add((region) => {
        if (!selectedRegion) return;
        if (region === selectedRegion) {
            self.onSelectedRegionChanged.dispatch(selectedRegion);
        }
    });

    regions.onMerged.add((srcRegion,tgtRegion)=> {
        if (srcRegion === selectedRegion) selectRegion(tgtRegion);
    });


    regions.onDestroyed.add(region=> {
    if (!selectedRegion) return;
        if (region === selectedRegion) {
            selectRegion(null);
        }
    });

    //default scene
    changeSceneNow(defaultSpectatorScene);

    actions.attachGuard('wait for scene transition',(prevAction, nextAction)=> new Promise(resolve => {

        let promises = [];
        if (prevAction && scene.postActionGuards[prevAction.name]) {
            promises.push(scene.postActionGuards[prevAction.name]);
        }
        if (nextAction && scene.preActionGuards[nextAction.name]) {
            promises.push(scene.preActionGuards[nextAction.name](resolve));
        }

        return Promise.all(promises).then(resolve);
    }));


    // scene switching based on actions
    actions.setHandler('AWAIT_PLAYER_INPUT', (action) => {
        action.data.prevScene = scene.name;
        if (scene!=scenes.PLAYER_TURN) changeScene('PLAYER_TURN');
        resumeActionsCallback = action.resolve;
    },
    {
        undo(action) {
            changeScene(action.data.prevScene);
        }
    });

    gameState.onReset.add(()=> {
        resumeActionsCallback = null; // discard callback for previous AWAIT_PLAYER_TURN if present
        changeSceneNow(defaultSpectatorScene);
        selectRegion(null);
        updateWorldBounds();
    });

    const resizeHandler = debounce(()=> {
        updateWorldBounds();
        self.onResize.dispatch();
    }, 200);

    game.scale.onSizeChange.add(resizeHandler);


    function updateWorldBounds() {
        let bounds = Renderer.calculateWorldBounds(grid);
        bounds.height+=200;
        if (bounds.width<game.camera.width) {
            let neededPadding = game.camera.width - bounds.width;
            bounds.left -= neededPadding/2;
            bounds.right += neededPadding/2;
        }
        if (bounds.height<game.camera.height) {
            let neededPadding = game.camera.height - bounds.height;
            bounds.y -= neededPadding - 64;
        }
        log.debug(`Setting bounds to ${bounds}`);
        game.world.setBounds(bounds.left, bounds.top, bounds.width, bounds.height);
    }

    function changeScene(nextSceneName) {
        return new Promise(resolve=> {
            let prevScene = scene || { teardown: ()=>Promise.resolve() };
            uiElements.tweens
                .waitForAll()
                .then(prevScene.teardown())
                .then(()=>{
                    _setupNextScene(nextSceneName);
                    resolve();
                });

        });
    }

    function reloadScene() {
        changeSceneNow(scene.name);
    }

    function showRestartMenu() {
        uiElements.modals.show('RESTART_GAME', result=> {
            switch (result) {
                case 'NEW_ISLAND':
                    spec.actions.abortAll();
                    spec.actions.schedule('LOAD_STATE','konkr_autosave_prestart');
                    if (resumeActionsCallback) processActions();
                    break;
                case 'RESTART':
                    actions.abortAll();
                    actions.schedule('RESTART_GAME');
                    if (resumeActionsCallback) processActions();
                    break;
                case null: 
                    return;
                default: 
                    throw Error(`No action bound to menu item ${result}`);
            }
        });
    }

    function undo() {
        actions.undoUntil('AWAIT_PLAYER_INPUT');
        changeSceneNow('PLAYER_TURN');
    }

    function changeSceneNow(nextSceneName) {
        if (scene) scene.interrupt();
        uiElements.tweens.stopAll();
        _setupNextScene(nextSceneName);
    }

    function _setupNextScene(nextSceneName) {
        if (!scenes[nextSceneName]) throw Error(`Invalid scene name ${nextSceneName}`);
        scene = scenes[nextSceneName];
        Z_ORDER.forEach(
            elementId=> {
                let el = uiElements[elementId];
                if (scene.uiElements[elementId]) {
                    el.group.visible=true;
                    if (el.synchronize) el.synchronize();
                } else {
                    el.group.visible=false;
                }
            }
        );
        scene.setup();
    }

    function selectHex(hex) {
        selectedHex = hex;
        self.onHexSelected.dispatch(hex);
    }

    function selectRegion(region) {
        if (selectedRegion === region) return;
        selectedRegion = region;
        self.onRegionSelected.dispatch(selectedRegion);
    }

    function endTurn() {
        if (!resumeActionsCallback) {
            log.warn(`End turn called out of order`);
            return;
        }
        if (players.grabbedPawn) {
            log.warn("Can't end turn while holding a pawn!");
            return;
        }
        changeScene(defaultSpectatorScene).then(()=>{
            resumeActionsCallback();
            resumeActionsCallback = null;
        });
    }

    function processActions() {
        if (!resumeActionsCallback) {
            log.warn(`processActions called out of order`);
            return;
        }
        actions.schedule('AWAIT_PLAYER_INPUT');
        resumeActionsCallback();
        resumeActionsCallback = null;
    }

    function buyPawn(pawnType) {
        actions.schedule('BUY_UNIT', pawnType, selectedRegion);
        uiElements.sfx.grabPawn();
        processActions();
    }

    function render() {

    }

    function update() {

    }

    function toDebugString() {
        let elems = [];
        for (let key in scene.elements) {
            elems.push(key);
        }

        return `
${resumeActionsCallback?'<b>Waiting for player input...</b>':'Spectator mode'}

scene: ${scene.name}
uiElements: ${elems.join(', ')}`;
    }

    return self;
}

export default UIManager;