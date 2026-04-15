/*
    Illustrator Nesting - Documentation Verified Version
    Version: 2.4
*/

(function() {
    if (app.documents.length === 0) return;

    var doc = app.activeDocument;
    var selection = doc.selection;

    if (selection.length === 0) {
        alert("Markera objekten först.");
        return;
    }

    var spacing = parseFloat(prompt("Mellanrum (px):", "10")) || 0;

    // Hämta ritytans mått [left, top, right, bottom]
    var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
    var abRect = artboard.artboardRect; 
    var abLeft = abRect[0];
    var abTop = abRect[1];
    var abWidth = Math.abs(abRect[2] - abRect[0]);
    var abHeight = Math.abs(abRect[1] - abRect[3]);

    var tempFolder = Folder.temp + "/ai_nesting";
    if (!Folder(tempFolder).exists) Folder(tempFolder).create();
    
    var itemsFile = new File(tempFolder + "/items.txt");
    var resultsFile = new File(tempFolder + "/results.txt");

    if (resultsFile.exists) resultsFile.remove();

    // --- Steg 1: Exportera data (ID, Bredd, Höjd) ---
    itemsFile.open("w");
    itemsFile.writeln(abWidth + "," + abHeight + "," + spacing); // Första raden är ritytan
    for (var i = 0; i < selection.length; i++) {
        var item = selection[i];
        item.note = "item" + i;
        var vB = item.visibleBounds; // [left, top, right, bottom]
        var w = Math.abs(vB[2] - vB[0]);
        var h = Math.abs(vB[1] - vB[3]);
        itemsFile.writeln(item.note + "," + w + "," + h);
    }
    itemsFile.close();

    // --- Steg 2: Kör Python ---
    var scriptFile = new File($.fileName);
    var pythonScriptPath = scriptFile.parent.fsName + "\\pynesting\\app.py";
    var batFile = new File(tempFolder + "/run_nesting.bat");
    
    batFile.open("w");
    batFile.writeln("@echo off");
    batFile.writeln("python \"" + pythonScriptPath + "\"");
    batFile.close();
    
    batFile.execute();

    // --- Steg 3: Vänta på resultat ---
    var success = false;
    for (var r = 0; r < 40; r++) {
        $.sleep(500); 
        if (resultsFile.exists) {
            success = true;
            break;
        }
    }

    if (success) {
        $.sleep(200);
        applyResults(resultsFile);
    } else {
        alert("Nesting misslyckades: Python-motorn svarade inte.");
    }

    function applyResults(file) {
        file.open("r");
        while (!file.eof) {
            var line = file.readln();
            if (line == "") continue;
            var parts = line.split(",");
            var id = parts[0];
            var x = parseFloat(parts[1]);
            var y = parseFloat(parts[2]);
            
            var item = findByNote(id);
            if (item) {
                // Sätt absolut position: [Vänster, Topp]
                // res.y räknas som avstånd NERÅT från artboardens topp
                item.position = [abLeft + x, abTop - y];
            }
        }
        file.close();
        alert("Nesting slutförd!");
    }

    function findByNote(id) {
        for (var i = 0; i < selection.length; i++) {
            if (selection[i].note == id) return selection[i];
        }
        return null;
    }
})();
