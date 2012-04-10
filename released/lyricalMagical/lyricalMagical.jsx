(function() {
	if (!app.project || !app.project.activeItem) {
		alert("コンポジションを開いてください");
		return;
	}

	app.beginUndoGroup("lyricalMagical");
	
	var src = app.project.activeItem.layers.addText("サンプル\rテキスト");
	src.name = "歌詞src";
	var textDoc = src.property("ADBE Text Properties").property("ADBE Text Document");
	var newText = textDoc.value;
	newText.resetCharStyle();
	newText.fontSize = 20;
	newText.fillColor = [1, 0, 0];
	newText.strokeColor = [0, 0, 0];
	newText.strokeWidth = 2;
	newText.strokeOverFill = false;
	newText.applyStroke = true;
	newText.applyFill = true;
	textDoc.setValue(newText);
	
	var disp = app.project.activeItem.layers.addText("");
	disp.name = "歌詞";
	disp.property("Source Text").expression = (function() {
		var str = "//マーカー前のblankSec秒は空白、それ以外はsrcからテキスト読込\r";
		str += "blankSec = 3/30;\r";
		str += "\r";
		str += "texts = thisComp.layer('歌詞src').text.sourceText.split('\\r');\r";
		str += "if (marker && marker.numKeys >= 1) {\r";
		str += "\tn = marker.nearestKey(time);\r";
		str += "\tprev = n.index - (n.time > time);\r";
		str += "\tif (prev < 1) {\r";
		str += "\t\tvalue;\r";
		str += "\t} else if (prev < texts.length+1) {\r";
		str += "\t\t(prev>=marker.numKeys || marker.key(prev+1).time-blankSec>=time) ? texts[prev-1] : '';\r";
		str += "\t}\r}";
		return str;
	})();
	disp.property("Marker").setValueAtTime(disp.inPoint+1, new MarkerValue(""));
	disp.property("Marker").setValueAtTime(disp.inPoint+2, new MarkerValue(""));
	disp.property("Marker").setValueAtTime(disp.inPoint+3, new MarkerValue(""));
	
	var e = disp("Effects").addProperty("ADBE Fast Blur");
	e.property(1).setValue(50);
	e.property(1).expression =  (function() {
		var str = "//マーカーでは実入力値、それ以外ではdefaultValueが適用される\r";
		str += "preSec=10/30; //前何秒適用するか\r";
		str += "postSec=5/30; //後ろ何秒適用するか\r";
		str += "defaultValue=1;\r";
		str += "\r";
		str += "if (marker && marker.numKeys>0) {\r";
		str += "\tn = marker.nearestKey(time);\r";
		str += "\tsTime = n.time-preSec;\r";
		str += "\teTime= n.time+postSec;\r";
		str += "\tif (time <= n.time) {\r";
		str += "\t\tease(time, sTime, n.time, defaultValue, value);\r";
		str += "\t} else if (n.time < time) {\r";
		str += "\t\tease(time, n.time, eTime, value, defaultValue);\r";
		str += "\t} else {\r";
		str += "\t\tdefaultValue;\r";
		str += "\t}\r";
		str += "}\r";
		return str;
	})();

	app.endUndoGroup();
})();
