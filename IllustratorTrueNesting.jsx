/*
    AI True Nesting
    Version: 0.1 BETA
    Professional Nesting Engine for Adobe Illustrator
*/

#target illustrator

(function() {
    var SCRIPT_NAME = "AI True Nesting 0.1 BETA";
    var TEMP_FOLDER_NAME = "ai_nesting";
    
    function main() {
        if (app.documents.length === 0) {
            alert("Please open a document first.", SCRIPT_NAME);
            return;
        }

        // --- OS Compatibility Check (Windows Only for BETA) ---
        if ($.os.toLowerCase().indexOf('mac') !== -1) {
            alert("Compatibility Error:\n" + 
                  "Version 0.1 BETA currently supports Windows only.\n" + 
                  "A macOS solution is under development.", SCRIPT_NAME);
            return;
        }

        var doc = app.activeDocument;
        var selection = doc.selection;

        if (selection.length === 0) {
            alert("Please select the objects you want to nest.", SCRIPT_NAME);
            return;
        }

        var settings = showUI();
        if (!settings) return;

        var originalInteractionLevel = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        try {
            processNesting(doc, selection, settings);
        } catch (e) {
            alert("An unexpected error occurred:\n" + e.message + "\n(Line: " + e.line + ")", SCRIPT_NAME);
        } finally {
            app.userInteractionLevel = originalInteractionLevel;
        }
    }

    function showUI() {
        var dialog = new Window("dialog", SCRIPT_NAME);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 15;

        var pnl = dialog.add("panel", undefined, "Settings");
        pnl.orientation = "column";
        pnl.alignChildren = "left";
        pnl.margins = 15;

        var grpSpacing = pnl.add("group");
        grpSpacing.add("statictext", undefined, "Spacing between objects (px):");
        var txtSpacing = grpSpacing.add("edittext", undefined, "10");
        txtSpacing.characters = 5;

        var grpStrategy = pnl.add("group");
        grpStrategy.add("statictext", undefined, "Filling Strategy:");
        var drpStrategy = grpStrategy.add("dropdownlist", undefined, ["Minimize Roll Length (Y-priority)", "Minimize Roll Width (X-priority)"]);
        drpStrategy.selection = 0;

        var chkHighPrecision = pnl.add("checkbox", undefined, "High Precision (True Nesting)");
        chkHighPrecision.helpTip = "Uses irregular shapes instead of boxes. Takes longer.";
        chkHighPrecision.value = true;

        var grpButtons = dialog.add("group");
        grpButtons.alignment = "right";
        var btnCancel = grpButtons.add("button", undefined, "Cancel", {name: "cancel"});
        var btnOk = grpButtons.add("button", undefined, "Start Nesting", {name: "ok"});

        if (dialog.show() === 1) {
            return {
                spacing: parseFloat(txtSpacing.text) || 0,
                strategy: drpStrategy.selection.index,
                highPrecision: chkHighPrecision.value
            };
        }
        return null;
    }

    function processNesting(doc, selection, settings) {
        var tempFolder = new Folder(Folder.temp + "/" + TEMP_FOLDER_NAME);
        if (!tempFolder.exists) tempFolder.create();

        var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
        var abRect = artboard.artboardRect; 
        
        var abWidth = Math.abs(abRect[2] - abRect[0]);
        var abHeight = Math.abs(abRect[1] - abRect[3]);
        var abLeft = abRect[0];
        var abTop = abRect[1];

        var itemsFile = new File(tempFolder + "/items.txt");
        var resultsFile = new File(tempFolder + "/results.txt");
        var svgFile = new File(tempFolder + "/export.svg");

        if (resultsFile.exists) resultsFile.remove();

        itemsFile.open("w");
        itemsFile.writeln(abWidth + "," + abHeight + "," + settings.spacing + "," + (settings.highPrecision ? "1" : "0") + "," + settings.strategy);
        
        for (var i = 0; i < selection.length; i++) {
            var item = selection[i];
            var uid = "item" + i;
            item.note = uid;
            
            var vB = item.visibleBounds;
            var w = Math.abs(vB[2] - vB[0]);
            var h = Math.abs(vB[1] - vB[3]);
            itemsFile.writeln(uid + "," + w + "," + h);
        }
        itemsFile.close();

        if (settings.highPrecision) {
            exportSelectionToSVG(doc, selection, svgFile);
        }

        executePythonEngine(tempFolder);

        if (waitForFile(resultsFile, settings.highPrecision ? 300 : 40)) {
            applyNestingResults(selection, resultsFile, abLeft, abTop);
        } else {
            throw new Error("Nesting engine did not respond in time. Check log.txt in temp folder.");
        }
    }

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

    function executePythonEngine(folder) {
        var scriptFile = new File($.fileName);
        var engineExePath = scriptFile.parent.fsName + "\\pynesting\\app.exe";
        var batFile = new File(folder + "/run_nesting.bat");
        
        batFile.open("w");
        batFile.writeln("@echo off");
        // Quoted path to handle spaces in file system
        batFile.writeln("\"" + engineExePath + "\"");
        batFile.close();
        batFile.execute();
    }

    function applyNestingResults(selection, file, abLeft, abTop) {
        file.open("r");
        var movedCount = 0;
        var errorCount = 0;
        
        while (!file.eof) {
            var line = file.readln();
            if (line === "" || line === "null") continue;
            var parts = line.split(",");
            if (parts.length < 3) continue;
            
            var id = parts[0];
            var x = parseFloat(parts[1]);
            var y = parseFloat(parts[2]);
            var angle = parts.length > 3 ? parseFloat(parts[3]) : 0;
            
            var item = findItemInSelection(selection, id);
            if (item) {
                try {
                    if (Math.abs(angle) > 0.1) {
                        item.rotate(angle, true, true, true, true, Transformation.CENTER);
                    }
                    item.position = [abLeft + x, abTop - y];
                    movedCount++;
                } catch (err) {
                    errorCount++;
                }
            }
        }
        file.close();
        
        var msg = "Nesting completed!\nMoved " + movedCount + " objects.";
        if (errorCount > 0) msg += "\n(" + errorCount + " objects failed).";
        alert(msg, SCRIPT_NAME);
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

    main();

})();
