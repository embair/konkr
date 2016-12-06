import { assertDefined } from 'lib/util';


let lastComponentId = 0;
function generateComponentId() {
    return ++lastComponentId;
}


const components = {
    'pane' : (...args) => new Pane(...args),
    'label' : (...args) => new Label(...args),
};

class UIComponent {
    constructor({game, log}, def, parent) {
        assertDefined(game, def);
        this.name = def.name || def.component + '#'+ generateComponentId();
        this.parentContainer = (parent && parent.getContainer()) || game;
        this.game = game;
        this.image = this.createDisplayObject(def, def.width, def.height);
        assertDefined(this.image);
        this.image.inputEnabled = true;

        this.setPlacement(def);
        if (parent) {
            this.parentContainer.addChild(this.image);
        } else {
            this.image.fixedToCamera = true;
        }
    }

    addToGroup(group) {
        group.add(this.image);
    }

    createDisplayObject(def) {
        return this.game.add.image();
    }

    getContainer() {
        throw Error(`Component does not have a container.`);
    }

    setPlacement({hAlign, vAlign, x=0, y=0}) {
        if (hAlign) {
            this.setHAlign(hAlign);  
        }  else {
            this.image.x = x;
        }
        if (vAlign) {
            this.setVAlign(vAlign);
        } else {
            this.image.y = y;
        }
    }

    setHAlign(hAlign) {
        const img = this.image;
        switch (hAlign) {
            case 'left':
                img.x = 0;
                img.anchor.x = 0;
                break;
            case 'right':
                img.x = this.parentContainer.width;
                img.anchor.x = 1;
                break;
            case 'center':
                img.x = Math.floor(this.parentContainer.width/2);
                img.anchor.x = 0.5;
                break;
            default:
                throw Error('Illegal value for hAlign: '+hAlign);
        }
    }

    setVAlign(vAlign) {
        const img = this.image;
        switch (vAlign) {
            case 'top':
                img.y = 0;
                img.anchor.y = 0;
                break;
            case 'bottom':
                img.y = this.parentContainer.height;
                img.anchor.y = 1;
                break;
            case 'center':
                img.y = Math.floor(this.parentContainer.height/2);
                img.anchor.y = 0.5;
                break;
            default:
                throw Error('Illegal value for vAlign: '+vAlign);
        }      
    }
}

class Pane extends UIComponent {
    constructor(spec, def, parent) {
        super(spec, def, parent);
        let padding = def.padding || 0;
        this._container = this.game.add.tileSprite(
                                Math.floor(padding - this.image.width * this.image.anchor.x),
                                Math.floor(padding - this.image.height * this.image.anchor.y),
                                def.width-padding*2,
                                def.height-padding*2,
                                new Phaser.BitmapData(spec.game, 'blank', 1, 1));
        this.image.addChild(this._container);
    }

    createDisplayObject({width, height}) {
        return this.game.add.tileSprite(0, 0, width || 1, height || 1, 'paneBackground');
    }

    getContainer() {
        return this._container;
    }
}

class Label extends UIComponent {
    createDisplayObject({text}) {
        var style = { font: "12pt Arial", fill: "black"};
        return this.game.add.text(0, 0, text || this.name,style);
    }

    get text() {
        return this.image.text;
    }

    set text(val) {
        this.image.text = val;
    }

    addColor(...args) {
        return this.image.addColor(...args);
    }

    resetColors() {
        this.image.colors=[];
    }
}


function UI (spec, def) {
    let {log, game} = spec;
    
    let self = {
        addComponent
    };
    addComponent(def);


    function addComponent(def, parent) {
        if (self[def.name]) throw new Error(`Duplicate component name '${def.name}'`);
        self[def.name] = createComponent(def, parent);
        if (def.contains) def.contains.forEach(childDef => {
            addComponent(childDef, self[def.name]);
        });
    }

    function createComponent(def, parent) {
        log.debug("Creating UI component", def);
        let constructorFunc = components[def.component];
        if (!constructorFunc) throw Error(`Unknown component type '${def.component}'`);
        return constructorFunc(spec,def,parent);
    }

   return self; 
}

export default UI;