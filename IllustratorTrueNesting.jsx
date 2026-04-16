/*
    Illustrator True Nesting - Professional Edition
    Refactored based on Adobe Scripting Best Practices
    Version: 3.0
*/

#target illustrator

(function() {
    // --- Global Constants & State ---
    var SCRIPT_NAME = "AI True Nesting Pro";
    var TEMP_FOLDER_NAME = "ai_nesting";
    
    /**
     * Entry Point
     */
    function main() {
        if (app.documents.length === 0) {
            alert("Vänligen öppna ett dokument först.", SCRIPT_NAME);
            return;
        }

        var doc = app.activeDocument;
        var selection = doc.selection;

        if (selection.length === 0) {
            alert("Vänligen markera objekten du vill nesta.", SCRIPT_NAME);
            return;
        }

        // --- Step 1: UI Implementation (ScriptUI Best Practices) ---
        var settings = showUI();
        if (!settings) return; // User cancelled

        // --- Step 2: Environment Setup ---
        var originalInteractionLevel = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        try {
            processNesting(doc, selection, settings);
        } catch (e) {
            alert("Ett oväntat fel uppstod:\n" + e.message + "\n(Rad: " + e.line + ")", SCRIPT_NAME);
        } finally {
            // Restore environment
            app.userInteractionLevel = originalInteractionLevel;
        }
    }

    /**
     * Show Professional ScriptUI Dialog
     */
    function showUI() {
        var dialog = new Window("dialog", SCRIPT_NAME);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 15;

        // Settings Panel
        var pnl = dialog.add("panel", undefined, "Inställningar");
        pnl.orientation = "column";
        pnl.alignChildren = "left";
        pnl.margins = 15;

        var grpSpacing = pnl.add("group");
        grpSpacing.add("statictext", undefined, "Mellanrum mellan objekt (px):");
        var txtSpacing = grpSpacing.add("edittext", undefined, "10");
        txtSpacing.characters = 5;

        var chkHighPrecision = pnl.add("checkbox", undefined, "Hög precision (True Nesting)");
        chkHighPrecision.helpTip = "Använder oregelbundna former istället för boxar. Tar längre tid.";
        chkHighPrecision.value = false;

        // Buttons
        var grpButtons = dialog.add("group");
        grpButtons.alignment = "right";
        var btnCancel = grpButtons.add("button", undefined, "Avbryt", {name: "cancel"});
        var btnOk = grpButtons.add("button", undefined, "Starta Nesting", {name: "ok"});

        if (dialog.show() === 1) {
            return {
                spacing: parseFloat(txtSpacing.text) || 0,
                highPrecision: chkHighPrecision.value
            };
        }
        return null;
    }

    /**
     * Main Processing Logic
     */
    function processNesting(doc, selection, settings) {
        var tempFolder = new Folder(Folder.temp + "/" + TEMP_FOLDER_NAME);
        if (!tempFolder.exists) tempFolder.create();

        var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
        var abRect = artboard.artboardRect; // [left, top, right, bottom]
        
        // Adobe Best Practice: Document Coordinate System Awareness
        var abWidth = Math.abs(abRect[2] - abRect[0]);
        var abHeight = Math.abs(abRect[1] - abRect[3]);
        var abLeft = abRect[0];
        var abTop = abRect[1];

        var itemsFile = new File(tempFolder + "/items.txt");
        var resultsFile = new File(tempFolder + "/results.txt");
        var svgFile = new File(tempFolder + "/export.svg");

        if (resultsFile.exists) resultsFile.remove();

        // --- Data Export ---
        itemsFile.open("w");
        // Row 1: Artboard Config
        itemsFile.writeln(abWidth + "," + abHeight + "," + settings.spacing + "," + (settings.highPrecision ? "1" : "0"));
        
        for (var i = 0; i < selection.length; i++) {
            var item = selection[i];
            var uid = "item" + i;
            item.note = uid; // Safe storage for ID
            
            var vB = item.visibleBounds; // Adobe Documentation: Safe measurement including strokes
            var w = Math.abs(vB[2] - vB[0]);
            var h = Math.abs(vB[1] - vB[3]);
            itemsFile.writeln(uid + "," + w + "," + h);
        }
        itemsFile.close();

        // Optional SVG Export for True Nesting
        if (settings.highPrecision) {
            exportSelectionToSVG(doc, selection, svgFile);
        }

        // --- External Engine Call ---
        executePythonEngine(tempFolder);

        // --- Wait for Results ---
        if (waitForFile(resultsFile, settings.highPrecision ? 120 : 40)) {
            applyNestingResults(selection, resultsFile, abLeft, abTop);
        } else {
            throw new Error("Nesting-motorn svarade inte i tid.");
        }
    }

    /**
     * Export SVG for True Nesting (Irregular Shapes)
     */
    function exportSelectionToSVG(doc, selection, file) {
        var exportOptions = new ExportOptionsSVG();
        exportOptions.fontType = SVGFontType.OUTLINEFONT;
        exportOptions.embedRasterImages = false;
        
        var tempDoc = app.documents.add(DocumentColorSpace.RGB, doc.width, doc.height);
        for (var i = 0; i < selection.length; i++) {
            var copy = selection[i].duplicate(tempDoc, ElementPlacement.PLACEATEND);
            copy.name = selection[i].note;
        }
        tempDoc.exportFile(file, ExportType.SVG, exportOptions);
        tempDoc.close(SaveOptions.DONOTSAVECHANGES);
    }

    /**
     * Execute Python via Batch
     */
    function executePythonEngine(folder) {
        var scriptFile = new File($.fileName);
        var pythonScriptPath = scriptFile.parent.fsName + "\\pynesting\\app.py";
        var batFile = new File(folder + "/run_nesting.bat");
        
        batFile.open("w");
        batFile.writeln("@echo off");
        batFile.writeln("python \"" + pythonScriptPath + "\"");
        batFile.close();
        batFile.execute();
    }

    /**
     * Apply coordinates back to objects
     */
    function applyNestingResults(selection, file, abLeft, abTop) {
        file.open("r");
        var movedCount = 0;
        while (!file.eof) {
            var line = file.readln();
            if (line === "") continue;
            var parts = line.split(",");
            var id = parts[0];
            var x = parseFloat(parts[1]);
            var y = parseFloat(parts[2]);
            
            var item = findItemInSelection(selection, id);
            if (item) {
                // Adobe Best Practice: Position [left, top]
                // res.y is distance DOWN from artboard top
                item.position = [abLeft + x, abTop - y];
                movedCount++;
            }
        }
        file.close();
        alert("Nesting slutförd!\nFlyttade " + movedCount + " objekt.", SCRIPT_NAME);
    }

    function findItemInSelection(sel, id) {
        for (var i = 0; i < sel.length; i++) {
            if (sel[i].note === id) return sel[i];
        }
        return null;
    }

    function waitForFile(file, seconds) {
        for (var i = 0; i < seconds * 2; i++) {
            $.sleep(500);
            if (file.exists) return true;
        }
        return false;
    }

    // Run Script
    main();

})();
