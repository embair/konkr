const MAX_UNIT_MIGHT = 4;

function Marshal({pawns,economy,log},pawnList) {

    const pawnTypeByMight = {
        1: pawns.TROOP_1,
        2: pawns.TROOP_2,
        3: pawns.TROOP_3,
        4: pawns.TROOP_4,
    };

    const pawnsByMight = {
        1: [],
        2: [],
        3: [],
        4: []
    };
    let totalMight = 0;

    pawnList.forEach(pawn => {
        pawnsByMight[pawn.pawnType.might].push(pawn);
        totalMight+=pawn.pawnType.might;
    });

    return Object.freeze({
        gatherMight,
        totalMight() { return totalMight; }
    });

    function gatherMight(targetMight) {
        if (targetMight <= 1) targetMight = 1;
        if (targetMight > MAX_UNIT_MIGHT) return null;
        //1. check if we already have a troop fit for the job
        for (let might = targetMight; might <= MAX_UNIT_MIGHT; ++might ) {
            if (pawnsByMight[might].length) {
                totalMight-=might;
                return { use: [pawnsByMight[might].pop()], result: pawnTypeByMight[might] };
            }
        }
        //2. if not, try to merge units
        let merge = findMerge(targetMight);
        let mergedMight = merge.reduce((sum, troop)=> sum + troop.pawnType.might, 0);
        totalMight-=mergedMight;
        if (mergedMight >= targetMight) {
            return { use: merge, result: pawnTypeByMight[mergedMight] };
        } else {
            //3. if it's still not enough, try to buy a unit
            return { use: merge, buy: pawnTypeByMight[targetMight-mergedMight], result: pawnTypeByMight[targetMight] };
        }

    }

    function findMerge(targetMight) {
        // WARNING: Assumption: merging two units with might X + Y will yield a unit with migth=X.might+Y.might
        let selected = [];
        let currentMight = 0;
        for (let might = MAX_UNIT_MIGHT; might>0 && currentMight < targetMight; --might) {
            while (pawnsByMight[might].length && currentMight + might <= targetMight) {
                currentMight +=might;
                selected.push(pawnsByMight[might].pop());
            }
        }
        return selected;
    }
}

export default Marshal;