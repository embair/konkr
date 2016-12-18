//converts string like "Exponential.InOut" to the matching function from Phaser.Easing 
function easing(str) {
    var s = str.split(".");
    expect(s.length).toBe(2, "Invalid easing function ID: "+str);
    return Phaser.Easing[s[0]][s[1]];
}

//extendInPlace(base,child) ... recursively adds properties from child object to base object
function extendInPlace(base, child, stack="") {
    expect(base).toBeA('object', 'invalid base object');
    expect(child).toBeA('object', 'invalid extender');
    for (var key in child) {
        if (child.hasOwnProperty(key)) {
            if (typeof base[key] === 'object') {
                if (typeof child[key]!== 'object') {
                    log.error('invalid extension of ' + stack + "."+key+": cannot replace object by non-object");
                    return false;
                }
                extend(base[key], child[key], stack+"."+key);
            } else {
                base[key] = child[key];
            }
        }
    }
}

function extend(obj, props) {
    for(var prop in props) {
        if(props.hasOwnProperty(prop)) {
            obj[prop] = props[prop];
        }
    }
    return 
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

function SealedObject(parent = Object, props = {}) {
    function F() {
        return props;        
    }
    F.prototype = parent;
    return new F();
}

function assertDefined(...args) {
    args.forEach( (arg, i) => { 
        if (arg === undefined) throw Error(`Argument #${i+1} is undefined.`);
        if (arg === null) throw Error(`Argument #${i+1} is null.`);
    });
}

function isFunction(obj) {
    return typeof obj === 'function';
}


function isObject(obj) {
    return typeof obj === 'object';
}

function signedNumber(num) {
    return String(num>=0?'+':'')+num;
}

function onFirefox() {
    return (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1 );
}

class OrderedMap {
    constructor() {
        this._keys = [];
        this._vals = {};
    }

    push(k,v) {
        if (this._vals[k] === undefined) this._keys.push(k);
        this._vals[k] = v;
    }

    insert(pos,k,v) {
        if (this._vals[k] === undefined) {
            this._keys.splice(pos,0,k);
            this._vals[k] = v;
        }
    }

    forEach(fn) {
        this.keys.forEach((k) => fn(k,this._vals[k]));
    }

    get(k) { 
        return this._vals[k]; 
    }

    indexOfKey(k) {
        return this._keys.indexOf(k);
    }

    at(i) {
        return this._vals[this._keys[i]];
    }

    iterator() {
        let current = 0;
        return {
            next() { return this._vals[current++]; }
        };
    }

    get length() {
        return this._keys.length;
    }

    get keys() {
        return this._keys;
    }

    get values() {
        return this._keys.map(k => this._vals[k]);
    }
};

window.OrderedMap = OrderedMap;

//==================
// CHEATS
var Cheat = {
    search : function(sequence) {
        return Dictionary.get()._impl.search(sequence,20);
    },
    lifes : function(amount) {
        inspect.director.addLifes(amount);
    }
};

//==================
// CACHE

var Cache = function(func, context, limit) {
    expect(func).toBeA('function');
    this.func = func;
    this.context = context;
    this.data = {};
    this.dataQueue = [];
    this.limit = limit;
};

Cache.prototype.get = function (key, callback) {
    if (this.data[key]) {
        log.debug("CACHE HIT", key);
        return callback.apply(this,this.data[key]);
    }
    var self = this;
    log.debug("CACHE MISS", key);
    this.func(key,processResult);
    function processResult() {
        self.data[key] = arguments;
        self.dataQueue.push(key);
        while (self.dataQueue.length > self.limit) {
            self.invalidate(self.dataQueue.shift());
        }
        callback.apply(self,arguments);
    }
};

Cache.prototype.invalidate = function(key) {
    delete(this.data[key]);
};

Cache.test = function() {
    function f(x,callback) {
        callback(x, x*x, x+x);
    }

    var func = new Cache(f,this,3);
    func.get(1, log.debug);
    func.get(2, log.debug);
    func.get(3, log.debug);
    func.get(1, log.debug);
    func.get(3, log.debug);
    func.get(4, log.debug);
    func.get(1, log.debug);
    func.get(1, log.debug);
    func.get(2, log.debug);
};


//==================
// RANDOMIZERS


/*
var a = { a: { a1: 1, a2: 2}, b:'b' }
var b = { a: { a1: 3 } }

extend(a,b);
console.debug("TEST1:",a);
*/


export { 
    OrderedMap,
    isFunction,
    isObject,
    assertDefined,
    signedNumber,
    debounce,
    extend
};