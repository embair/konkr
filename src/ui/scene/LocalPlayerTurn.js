import Scene from './Scene';

function LocalPlayerTurn(spec){

    let { actions,  players, pawns, regions, ui, economy, log,
          sfx, pawnSprites, landSprites, feedbackSymbols, scrolling, hexTooltips, help } = spec;

    return new Scene(spec, { 
    name: 'PLAYER_TURN',
        uiElements: {
            landSprites:true,
            regionBorders:true,
            selRegionHighlight:true,
            conquerableHexesHighlight: true,
            pawnSprites:true,
            gridOverlays:true,
            hexSelectionProxy:true,
            messages:true,
            uiRegionPanel:true,
            nextTurnButton:true,
            grabbedPawn:true,
            feedbackSymbols:true,
            optionButtons:true,
            hexTooltips:true,
            uiTooltips:true,
        },
        bindSignals: {
            pawns: {
                onCreated: onPawnCreated,
                onDestroyed: onPawnDestroyed,
            },
            regions: {
                onHexesChangedOwner: landSprites.refreshHexes
            },
            economy: {
                onRegionTreasuryChanged                
            },
            ui: {
                onHexSelected,
                onHexHovered
            }
        },
        setup,
        teardown
    });

    function setup() {
        pawnSprites.highlightIdle = true;
    }

    function teardown() {
        pawnSprites.highlightIdle = false;   
    }

    function onPawnCreated(pawn) {
        let p = pawnSprites.getOrCreate(pawn.hex, pawn.pawnType);
        p.fadeIn();
    }
    function onPawnDestroyed(pawn) {
        pawnSprites.destroySprite(pawn.hex);
    }
    function onHexHovered(hex) {
        hexTooltips.hide();
        if (players.activePlayer.grabbedPawn) return;
        const pawn = pawns.pawnAt(hex);
        if (pawn) hexTooltips.showDelayed('HEX_TOOLTIP', hex, help.pawnInfo(pawn));
    }
    function onHexSelected(hex) {
        let showPawnTooltip = false;
        if (players.grabbedPawn) {
            scrolling.mode="CAMERA";
            if (players.activePlayer.canDropPawnAt(hex)) {
                actions.schedule('DROP_UNIT', hex);
                sfx.dropPawn();
                feedbackSymbols.showDefendedBy(hex, players.grabbedPawn.defense);
                ui.processActions();
            } else if (players.activePlayer.canConquerHex(hex)) {
                actions.schedule('CONQUER_HEX', hex);
                sfx.dropPawn();
                ui.processActions();
            } else {
                sfx.deny();
                if (regions.regionOf(hex) === ui.selectedRegion) {
                    log.warn(`Tile is occupied!`);
                } else if (!players.grabbedPawnRegion.hexes.neighbours().contains(hex)) {
                    log.warn(`Can't reach this tile!`);
                } else {
                    feedbackSymbols.showDefendersOf(hex, players.grabbedPawn.might);
                    log.warn('Stronger unit needed to conquer this tile!');
                }
            }
        } else {
            if (pawns.pawnAt(hex) && players.activePlayer.canGrabPawn(pawns.pawnAt(hex))) {
                scrolling.mode="PAWN";
                hexTooltips.hide();
                actions.schedule('UNDO_MARKER');
                actions.schedule('GRAB_UNIT', pawns.pawnAt(hex));
                sfx.grabPawn();
                ui.processActions();
            } else {
                scrolling.mode="CAMERA";
                if (pawns.pawnAt(hex)) {
                    showPawnTooltip = true;
                }
            }
            const r = regions.regionOf(hex);
            if (players.activePlayer.controls(r) && economy.capitalOf(r)) {
                if (ui.selectedRegion!=r) showPawnTooltip = false;
                ui.selectRegion(regions.regionOf(hex));
            } else {
                ui.selectRegion(null);
            }

            if (showPawnTooltip) {
                feedbackSymbols.showDefendedBy(hex, 99);
                //popovers.show('HEX_TOOLTIP', hex, help.pawnInfo(pawns.pawnAt(hex)));
            }
        }
    }
    function onRegionTreasuryChanged(region) {
        if (economy.capitalOf(region)) pawnSprites.getOrCreate(economy.capitalOf(region), pawns.TOWN).refreshDecorations();
    }
}

export default LocalPlayerTurn;