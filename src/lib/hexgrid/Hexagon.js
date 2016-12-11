import { Random } from 'lib/util';
import expect from 'expect';

const DIRECTION =             {0:'UP_LEFT',1:'UP_RIGHT',2:'RIGHT',3:'DOWN_RIGHT',4:'DOWN_LEFT', 5:'LEFT'};
const HEX_ADJACENCY_VECTORS = [  [-1,-1],    [-1,0],      [0,1],    [1,1],         [1,0],       [0,-1]];

const NullHex = {
    toString: () => "[Null Hex]",
    neighbours: () => [],
    id: -1,    
    exists: () => false,
    position: {
        x: -1, 
        y: -1, 
        r: -1,
        c: -1,
        index: -1,
        toString: () => "[Null GridPoint]"
    },
    floodFill: null,
};

class HexGroupSet {
    constructor() {
        this.groups = {};
        this.membership = [];
        this._length = 0;
    }

    add(hexOrGroup, key) {
        hexOrGroup.forEach(hex => {
            if (this.membership[hex.id]) {
                if (this.membership[hex.id] === key) return;
                this.groups[key].remove(hex);
            } else if (!this.groups[key]) {
                this.groups[key] = new HexGroup();
                ++this._length;
            }
            this.groups[key].add(hex);
            this.membership[hex.id] = key;
        });
    }

    getOwnerOf(hex) {
        expect(hex).toExist();
        return this.membership[hex.id];
    }

    remove(key) {
        expect(this.groups[key]).toBeTruthy();
        this.groups[key].forEach(hex=> delete this.membership[hex.id]);
        delete this.groups[key];
        --this._length;
    }

    forEach(fn) {
        for (const key in this.groups) {
            fn(this.groups[key],key);
        }
    }

    map(fn) {
        let res = [];
        this.forEach((group,key)=>res.push(fn(group,key)));
        return res;
    }

    getLargestGroup() {
        var max = 0;
        var res = null;
        this.forEach(hexGroup => {
            if (hexGroup.length > max) {
                max = hexGroup.length;
                res = hexGroup;
            }
        });
        return res;
    }

    popLargestGroup() {
        var max = 0;
        var res = -1;
        var group = null;
        this.forEach((hexGroup, key) => {
            if (hexGroup.length > max) {
                max = hexGroup.length;
                res = key;
                group = this.groups[key];
            }
        });
        if (!group) return null;
        this.remove(res);
        return group;
    }    

    get length() {
        return this._length;
    }

    toString() {
        let total=0;
        let str = Object.keys(this.groups).map((key) => {
            const len = this.groups[key].length;
            total += len;
            return `${key}(${len})`;
        }).join(", ");
        return `[HexGroupSet (${total}): ${str}]`;
    }
}


class HexGroup {
    constructor(hexes) {
        this.members=[];
        this._length = 0;
        this._pivot = null;
        Object.seal(this);
        if (hexes) this.add(hexes);
    }

    contains(hex) {
        return !!this.members[hex.id];
    }

    containsId(id) {
        return !!this.members[id];
    }

    _findNewPivot() {
        if (!this.length) return null;
        for (const key in this.members) {
            this._pivot = this.members[key];
            return;
        }
    }

    get pivot() {
        return this._pivot;
    }

    border(includeShoreline=false) {
        return this.filter( hex => {
            if (includeShoreline && hex.neighbours().length<6) return true;
            return hex.neighbours().filter(h2 => !this.contains(h2)).length>0;
        });
    }

    borderIncludingShoreline() {
        return this.border(true);
    }

    neighbours() {
        let res = new HexGroup();
        this.forEach( hex => {
            res.add(hex.neighbours().filter(h2 => !this.contains(h2)));
        });
        return res;
    }

    components(condition=()=>true) {
        let comps = new HexGroupSet();
        let compNumber = 1;
        this.forEach(hex => {
            if (!comps.getOwnerOf(hex)) {
                comps.add(hex, compNumber);
                comps.add(hex.floodFill(hex2=>this.contains(hex2)), compNumber);
                ++compNumber;
            }
        });
        return comps;
    }

    getRandomHex() {
        if (!this.length) return null;
        let i = Random.integer(0, this._length-1);
        let n = 0;
        var res = null;
        this.members.some(hex => { 
            if( n++ === i) {
                res = hex;
                return true;
            }
        });
        return res;
    }

    getById(id) {
        return this.members[id];
    }

    add(hexOrGroup) {
        hexOrGroup.forEach(hex=>{
            if (this.members[hex.id]) return false;
            if (!this._pivot) this._pivot = hex;
            this.members[hex.id] = hex;
            ++this._length;
            return true;
        });
    }

    remove(hexOrGroup) {
        hexOrGroup.forEach(hex => {
            if (this.members[hex.id] === undefined) return;
            delete this.members[hex.id];
            --this._length;

            if (hex === this._pivot) {
                this._findNewPivot();
            }
        });
    }

    filter(fn) {
        return new HexGroup(this.members.filter(fn));
    }

    forEach(fn) {
        return this.members.forEach(fn);
    }

    sort(fn) {
        return this.members.sort(fn);
    }

    clone() {
        return new HexGroup(this.members);
    }

    clear() {
        this.members = [];
    }

    get length() {
        return this._length;
    }

    floodFill(condition = ()=>true) {
        let pending = this.clone(); 

        let nextPending;
        const processHex = thisHex => {
                this.add(thisHex);
                nextPending.add(thisHex.neighbours().filter((adjHex)=>filterCondition(adjHex,thisHex)));
        };
        const filterCondition = (thisHex,prevHex)=>condition(thisHex,prevHex) && !this.contains(thisHex);
        while (pending.length > 0) {
            //log.debug("Pending:"+ pending.toString());
            nextPending = new HexGroup();
            pending.forEach(processHex);
            pending = nextPending;
        }
    }

    toString() {
        return `[HexGroup (${this.length}): ${this.members.map(hex=>`#${hex.id}`).filter(a=>a!==undefined).join(",")}]`;
    }
}


class Hexagon {
    constructor(grid,gridPoint) {
        this.position = gridPoint;
        this.grid = grid;
        Object.freeze(this);
    }

    toString() {
        return `[Hex #${this.id} (${this.position.r},${this.position.c})]`;
    }

    neighbours(condition=()=>true) {
        const {r,c} = this.position;
        return HEX_ADJACENCY_VECTORS
            .map((change) => this.grid.getHexByAxial(r+change[0], c+change[1]))
            .filter((hex) => hex && condition(hex));        
    }

    border() { return this; }
    borderIncludingShoreline() { return this; }

    neighbour(direction) {
        return this.grid.getHexByAxial(this.position.r+HEX_ADJACENCY_VECTORS[direction][0],this.position.c+HEX_ADJACENCY_VECTORS[direction][1]);
    }

    floodFill(condition) {
        const res = new HexGroup([this]);
        res.floodFill(condition);
        return res;
    }

    forEach(fn) {
        fn(this);
    }

    filter(fn) {
        return new HexGroup([this].filter(fn));
    }

    map(fn) {
        return new HexGroup([fn(this)]);
    }

    get id() {
        return this.position.index;
    }

    get length() { return 1; }

    exists() { return true; }
}

NullHex.floodFill = () => new HexGroup();
Object.freeze(NullHex);

export { Hexagon, HexGroup, HexGroupSet };