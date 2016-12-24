import UI from 'lib/controls/UI';
import { assertDefined } from 'lib/util';

function NextTurnButton(spec) {
    let { game, ui } = spec;

    let group;

    let { nextTurnButton } = new UI(spec,{
            name: 'nextTurnButton',
            component: 'button',
            sprite: 'nextTurnButton',
            align: Phaser.BOTTOM_RIGHT,
            hOffset: -10,
            vOffset: -10,
        });

    let { undoButton } = new UI(spec,{
            name: 'undoButton',
            component: 'button',
            sprite: 'undoButton',
            align: Phaser.BOTTOM_LEFT,
            hOffset: -10,
            vOffset: -10,
        });

    assertDefined(nextTurnButton);
    group = game.make.group();
    group.add(nextTurnButton);
    group.add(undoButton);

    nextTurnButton.onInputUp.add(() => {
        ui.endTurn();
    });

    undoButton.onInputUp.add(() => {
        ui.undo();
    });

    return Object.freeze({
        get group() { return group }
    });
}

export default NextTurnButton;