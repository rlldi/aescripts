app.beginUndoGroup("eachLayer");
(function() {
	var ls=app.project.activeItem.selectedLayers, layer;
	for(var i=0;i<ls.length;i++){
		layer = ls[i];
		//write any code you want to do with each layers selected.
		//e.g.
		//layer.parent=null;
	}
})();
app.endUndoGroup();
