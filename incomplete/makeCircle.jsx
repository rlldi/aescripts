//idea by okiyama

(function() {
	var comp = app.project.activeItem,
		sel = (comp.selectedLayers ? comp.selectedLayers[0] : null),
		layer = comp.addSolid([0,0,0], "円", 1000, 1000, comp.pixelAspect, comp.duration);
	if (sel) layer.moveBefore(sel[0]);
	layer.threeDLayer = true;
	layer.property("Effects").addProperty("円");
	//layer.property("Effects").property("円").property()...
})();