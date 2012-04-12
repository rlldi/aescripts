//idea by xxjulexx

(function() {
	var comp = app.project.activeItem,
		sel = (comp.selectedLayers ? comp.selectedLayers[0] : null),
		layer = comp.addSolid([0,0,0], "Particular", comp.width, comp.height, comp.pixelAspect, comp.duration);
	if (sel) layer.moveBefore(sel[0]);
	layer.property("Effects").addProperty("Trapcode Particular");
	layer.blendingMode = BlendingMode.ADD;
})();