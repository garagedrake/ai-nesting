/*
    Illustrator True Nesting
    Version: 0.1 (BETA)
    Professional Nesting Engine for Adobe Illustrator
*/

#target illustrator

(function() {
    var SCRIPT_NAME = "AI True Nesting";
    var TEMP_FOLDER_NAME = "ai_nesting";
    
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

        var settings = showUI();
        if (!settings) return;

        var originalInteractionLevel = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        try {
            processNesting(doc, selection, settings);
        } catch (e) {
            alert("Ett oväntat fel uppstod:\n" + e.message + "\n(Rad: " + e.line + ")", SCRIPT_NAME);
        } finally {
            app.userInteractionLevel = originalInteractionLevel;
        }
    }

    function showUI() {
        var dialog = new Window("dialog", SCRIPT_NAME);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 15;

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
        chkHighPrecision.value = true;

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
        itemsFile.writeln(abWidth + "," + abHeight + "," + settings.spacing + "," + (settings.highPrecision ? "1" : "0"));
        
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
            throw new Error("Nesting-motorn svarade inte i tid. Kontrollera log.txt i temp-mappen.");
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
        var pythonScriptPath = scriptFile.parent.fsName + "\\pynesting\\app.py";
        var batFile = new File(folder + "/run_nesting.bat");
        
        batFile.open("w");
        batFile.writeln("@echo off");
        batFile.writeln("python \"" + pythonScriptPath + "\"");
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
        
        var msg = "Nesting slutförd!\nFlyttade " + movedCount + " objekt.";
        if (errorCount > 0) msg += "\n(" + errorCount + " objekt misslyckades).";
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
