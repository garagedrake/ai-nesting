/*
    Illustrator Nesting & Weeding Frame Script
    Version: 1.2
    Description: Performs box nesting based on active artboard size with error handling for overflows.
*/

(function() {
    if (app.documents.length === 0) {
        alert("Vänligen öppna ett dokument och markera objekt att nesta.");
        return;
    }

    var doc = app.activeDocument;
    var selection = doc.selection;

    if (selection.length === 0) {
        alert("Vänligen markera minst ett objekt.");
        return;
    }

    // --- Unit Handling ---
    var docUnits = doc.rulerUnits;
    var unitName = "mm";
    var pointsPerUnit = 2.834645;

    switch (docUnits) {
        case RulerUnits.Millimeters: unitName = "mm"; pointsPerUnit = 2.834645; break;
        case RulerUnits.Centimeters: unitName = "cm"; pointsPerUnit = 28.34645; break;
        case RulerUnits.Inches: unitName = "in"; pointsPerUnit = 72; break;
        case RulerUnits.Points: unitName = "pt"; pointsPerUnit = 1; break;
        case RulerUnits.Pixels: unitName = "px"; pointsPerUnit = 1; break;
        default: unitName = "enheter"; pointsPerUnit = 1;
    }

    function toPoints(val) { return parseFloat(val) * pointsPerUnit; }
    function fromPoints(val) { return val / pointsPerUnit; }

    // Get Active Artboard info
    var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
    var abRect = artboard.artboardRect; // [left, top, right, bottom]
    var abWidth = Math.abs(abRect[2] - abRect[0]);
    var abHeight = Math.abs(abRect[1] - abRect[3]);
    var abBottom = abRect[3];

    // --- UI Setup ---
    var dialog = new Window("dialog", "AI Nesting - Artboard Mode");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];

    var infoText = dialog.add("statictext", undefined, "Använder rityta: " + Math.round(fromPoints(abWidth)) + "x" + Math.round(fromPoints(abHeight)) + " " + unitName);
    infoText.graphics.font = ScriptUI.newFont ("sans", "BOLD", 12);

    // Settings Panel
    var settingsPanel = dialog.add("panel", undefined, "Inställningar (" + unitName + ")");
    settingsPanel.orientation = "column";
    settingsPanel.alignChildren = "left";

    var spacingGroup = settingsPanel.add("group");
    spacingGroup.add("statictext", undefined, "Mellanrum mellan objekt:");
    var spacingInput = spacingGroup.add("edittext", undefined, "2");
    spacingInput.characters = 10;

    // Options Panel
    var optionsPanel = dialog.add("panel", undefined, "Alternativ");
    optionsPanel.orientation = "column";
    optionsPanel.alignChildren = "left";

    var allowRotationCheck = optionsPanel.add("checkbox", undefined, "Tillåt 90° rotation");
    allowRotationCheck.value = true;

    var useWeedingCheck = optionsPanel.add("checkbox", undefined, "Lägg till rensramar");
    useWeedingCheck.value = false;

    var offsetGroup = optionsPanel.add("group");
    offsetGroup.add("statictext", undefined, "Ram-marginal:");
    var offsetInput = offsetGroup.add("edittext", undefined, "1");
    offsetInput.characters = 10;
    offsetInput.enabled = false;

    useWeedingCheck.onClick = function() {
        offsetInput.enabled = useWeedingCheck.value;
    };

    // Buttons
    var btnGroup = dialog.add("group");
    btnGroup.alignment = "right";
    var cancelBtn = btnGroup.add("button", undefined, "Avbryt", {name: "cancel"});
    var okBtn = btnGroup.add("button", undefined, "Starta Nesting", {name: "ok"});

    if (dialog.show() !== 1) return;

    // --- Processing ---
    var spacing = toPoints(spacingInput.text);
    var useWeeding = useWeedingCheck.value;
    var weedingOffset = toPoints(offsetInput.text);
    var allowRotation = allowRotationCheck.value;

    var items = [];
    for (var i = 0; i < selection.length; i++) {
        var obj = selection[i];
        var bounds = obj.visibleBounds;
        var w = Math.abs(bounds[2] - bounds[0]);
        var h = Math.abs(bounds[1] - bounds[3]);
        
        var rotated = false;
        // Initial optimization: Lay them down if it saves vertical space
        if (allowRotation && h > w) {
            var temp = w; w = h; h = temp;
            rotated = true;
        }

        var effW = w + (useWeeding ? weedingOffset * 2 : 0);
        var effH = h + (useWeeding ? weedingOffset * 2 : 0);

        // Pre-check: Does a single item even fit?
        if (effW > abWidth || effH > abHeight) {
            // Try rotating back if that helps
            if (allowRotation && (effH <= abWidth && effW <= abHeight)) {
                // It fits if rotated
            } else {
                alert("FEL: Objektet '" + (obj.name || "Namnlöst") + "' är större än ritytan!");
                return;
            }
        }

        items.push({
            obj: obj,
            w: effW,
            h: effH,
            origW: w,
            origH: h,
            bounds: bounds,
            wasRotated: rotated
        });
    }

    // Sort by height descending
    items.sort(function(a, b) { return b.h - a.h; });

    // --- Packing Algorithm ---
    var currentX = 0;
    var currentY = 0;
    var shelfHeight = 0;
    var placedCount = 0;
    var startX = abRect[0];
    var startY = abRect[1];

    for (var j = 0; j < items.length; j++) {
        var item = items[j];

        // Try rotating to fit width if needed
        if (allowRotation && (currentX + item.w > abWidth) && (currentX + item.h <= abWidth)) {
            var temp = item.w; item.w = item.h; item.h = temp;
            item.wasRotated = !item.wasRotated;
        }

        // New shelf?
        if (currentX + item.w > abWidth) {
            currentX = 0;
            currentY -= (shelfHeight + spacing);
            shelfHeight = 0;
        }

        // Check vertical fit
        if (startY + currentY - item.h < abBottom) {
            alert("SLUT PÅ PLATS: Kunde inte få plats med alla objekt på ritytan.\n" + (items.length - placedCount) + " objekt återstår.");
            return;
        }

        // Apply rotation
        if (item.wasRotated) {
            item.obj.rotate(90);
        }

        var newBounds = item.obj.visibleBounds;
        var targetX = startX + currentX;
        var targetY = startY + currentY;

        var objLeft = targetX + (useWeeding ? weedingOffset : 0);
        var objTop = targetY - (useWeeding ? weedingOffset : 0);

        var dx = objLeft - newBounds[0];
        var dy = objTop - newBounds[1];

        item.obj.translate(dx, dy);

        if (useWeeding) {
            var rect = doc.pathItems.rectangle(targetY, targetX, item.w, item.h);
            rect.filled = false;
            rect.stroked = true;
            rect.strokeWidth = 0.5;
            
            var group = doc.groupItems.add();
            rect.move(group, ElementPlacement.PLACEATBEGINNING);
            item.obj.move(group, ElementPlacement.PLACEATEND);
        }

        currentX += (item.w + spacing);
        if (item.h > shelfHeight) shelfHeight = item.h;
        placedCount++;
    }

    alert("Nesting klar! " + placedCount + " objekt placerade på ritytan.");

})();
