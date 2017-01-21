import Injector from 'lib/Injector';
import Menu from './modals/Menu';
import InputProxy from 'lib/InputProxy';

function ModalsManager(spec) {
    let { game, ui } = spec;

    let group = game.make.group(),
        inputProxy = new InputProxy(game),
        currentModal = null,
        currentModalCallback = null;

    let library = new Injector(null, {
        RESTART_GAME: () => new Menu(spec, {
            title: 'Start a new game?',
            choices: [
                {
                    id: 'RESTART',
                    title: 'Restart',
                    description: 'Discard current progress and start again on this island',
                },
                {
                    id: 'NEW_ISLAND',
                    title: 'New island',
                    description: 'Discard current progress and start on a new island',
                }
            ],
            canCancel: true,
            callback: resolveModal
        }),
        VICTORY_SCREEN: () => new Menu(spec, {
            title: 'Congratulations! Your rivals have surrendered before your might!',
            choices: [
                {
                    id: 'NEW_ISLAND',
                    title: 'Start a new game',
                    description: 'Onwards to the next challenge!',
                },
                {
                    id: 'KEEP_PLAYING',
                    title: 'Keep playing',
                    description: 'Surrender?! Oh hell no!',
                }
            ],
            canCancel: false,
            callback: resolveModal
        }),
        DEFEAT_SCREEN: () => new Menu(spec, {
            title: 'You have been defeated. Such is life.',
            choices: [
                {
                    id: 'RESTART',
                    title: 'Restart',
                    description: 'Start again on this island. You can do this!',
                },            
                {
                    id: 'NEW_ISLAND',
                    title: 'New island',
                    description: 'Try playing on another island.',
                },
                {
                    id: 'KEEP_PLAYING',
                    title: 'Keep watching',
                    description: 'Watch your opponents fight each other',
                }
            ],
            canCancel: false,
            callback: resolveModal
        })
    });

    inputProxy.events.onInputUp.add(()=> {
        if (currentModal && currentModal.canCancel) resolveModal(null);
    });

    return Object.freeze({
        get group() { return group; },
        show
    });

    function show(key, callback) {
        if (currentModal) resolveModal();
        currentModal = library[key];
        if (!currentModal) {
            throw Error(`Unknown modal type: ${key}`);
        }
        group.removeAll();
        group.add(inputProxy);
        group.add(currentModal.group);
        if (callback) currentModalCallback = callback;
        currentModal.show();
    }

    function resolveModal(result) {
        currentModal.hide();
        group.remove(inputProxy);
        currentModal = null;
        if (currentModalCallback) {
            currentModalCallback(result);
            currentModalCallback = null;
        }
    }

}

export default ModalsManager;