import Heap from 'heap';

function Adhoc(valuationFunc) {
    return Object.freeze({
        get,
    });

    function get(hex, ...args) {
        return valuationFunc(hex, ...args);
    }
}

function Manual(defaultValue, heapFunction = (a,b)=> b.val - a.val) {
    let data = {},
        heap = new Heap(heapFunction);

    return Object.freeze({
        // get(hex) => stored value for hex or defaultValue
        get,
        // set(hex, value) ... stores value for hex
        set,
        // pop => { hex, value } | null
        // returns max value based on heapFunction and removes it from the valuation
        // return null if valuation is empty
        pop, 
        reset,
        peek
    });

    function get(hex) {
        if (data[hex.id] !== undefined) {
            return data[hex.id].val;
        } else {
            return defaultValue;
        }
    }

    function set(hex, value) {
        if (data[hex.id]) {
            data[hex.id].val = value;
            heap.updateItem(data[hex.id]);
        } else {
            const entry = {hex: hex, val:value};
            data[hex.id] = entry;
            heap.push(entry);
        }
    }

    function reset() {
        data = {};
        heap = new Heap(heapFunction);
    }

    function peek() {
        return heap.peek();
    }

    function pop() {
        let res = heap.pop();
        if (!res) return null;
        delete data[res.hex.id];
        return res;
    }
}


export default { Manual, Adhoc };