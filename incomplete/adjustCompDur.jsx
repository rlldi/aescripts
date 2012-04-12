//comp内の選択されたレイヤ（選択がない場合全レイヤ）のレイヤにcompの開始時間・終了時間を合わせる。
//idea by tripshot https://twitter.com/#!/tripshots/status/186669155641069568

app.biginUndoGroup("adjusting duration");

(function() {
	var comp = app.project.activeItem,
		targets = comp.selectedLayers,
		usedIns = comp.usedIn,
		target = null,
		in=Number.MAX_VALUE,
		out=0,
		tIn;
	
	if (targets.length == 0) {
		//選択がなければ全レイヤが対象
		for (var i=1; i<=comp.numLayers; i++) targets.push(comp.layer(i));
	}
	
	//in,outを求める
	for (var i=0; i<targets.length; i++) {
		in = Math.min(in, targets[i].inPoint);
		out = Math.max(out, targets[i].outPoint);
	}
	
	if (in != 0) {
		//中身のシフト
		for (var i=1; i<=comp.numLayers; i++) {
			comp.layer(i).inPoint -= in;
		}
		
		//usedInでの位置変更
		for (var i=0; i< usedIns.length; i++) {
			var j=1;
			while (usedIns[i].layer(j).source != comp) j++;
			target = usedIns[i].layer(j);
			tIn = target.inPoint;
			target.startTime += in;
			target.inPoint = tIn;
			target.outPoint -= in;
		}
	}
	
	//displayStartTimeの修正
	(function() {
		if (in == 0) return;
		if (comp.displayStartTime == 0 && !confirm("開始時間の表記を修正しますか？")) return;
		comp.displayStartTime += in;
	})();
	
	//compのデュレーション変更
	comp.duration = out-in;
})();

app.endUndoGroup();
