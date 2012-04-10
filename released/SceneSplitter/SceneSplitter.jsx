/*
=========================================================================================================
	Name: SceneSplitter
	Version: 1.2.1 (20111022)
	Author: rlldi
	Description: 
		オーディオ（を含む）レイヤーにつけられたマーカーを「シーンの区切り」と見なし、
		シーン単位のコンポジションを自動生成するスクリプトです。
		音楽に映像をつけるときとかに便利だと思います。
=========================================================================================================
*/

(function(parent){
	/*=========================================================================================================*/
	//デフォルト値設定。好きにいじってね。
	//-----------------------------------------------------------------------------------------------------
	var DURATION_BASIS = 0;				//デュレーション基準の初期設定　0:シーン 1:オーディオ 2:親コンポ
	var FIXES_START_TIMECODE = true;	//子コンポの開始タイムコードを親に合わせるかどうか
	var FORMAT = "$p[$i]$c";			//詳しくはちょっと下(HOW_TO_USE_FORMAT)を参照。
	var PRE_COMMENT = ": ";				//マーカーコメントがある場合、これをコメント手前に付加して$cとする
	var POST_COMMENT = "";				//マーカーコメントがある場合、これをコメント後ろに付加して$cとする
	var USES_TIME = true;				//$tをタイムコードで表示するかどうか。falseならフレーム数で表示
	var NEEDS_COMMA = false;			//$tでタイムコードに1秒未満のフレーム数表記をするかどうか
	
	/*=========================================================================================================*/
	//定数
	//-----------------------------------------------------------------------------------------------------
	var NAME = "SceneSplitter.jsx";
	var TITLE = "SceneSplitter";
	var NO_PROJ_ERR	 	 	 =   {en:"Open a project first.", jp:"プロジェクトを開いて下さい."};
	var NO_COMP_ERR	 	 	 =   {en:"Select a composition.", jp:"コンポジションを選択して下さい."};
	var MANY_LAYERS_ERR	 	 	 =   {en:"Too many selection of layers.", jp:"選択しすぎです。"};
	var NO_LAYER_ERR	 	 	 =   {en:"Select an audio layer.", jp:"オーディオレイヤーを選択してください。"};
	var NO_MARKER_ERR	 	 	 =   {en:"Add some markers for the audio layer.", jp:"オーディオレイヤーにマーカーつけてください。"};
	
	//フォーマット書式についての説明文
	var HOW_TO_USE_FORMAT = "次のような書式記号が使えます。\n"
							+ "--------------------\n"
							+ "$i : シーン番号\n"
							+ "$p : 親コンポ名\n"
							+ "$c : シーン名(オーディオレイヤーのマーカーコメントから取得)\n"
							+ "$t : タイムコード(親コンポ基準)\n"
							+ "$d : シーンのデュレーション\n"
							+ "--------------------\n"
							+ "たとえば、 $p[Scene$i]$t($d)$c と書けば、\n"
							+ "コンポ1[Scene3]2:03s(0:17s) :サビ\n"
							+ "のように変換されます。\n"
							+ "なお、決め打ちのフォーマットがあり毎回設定するのが面倒なら、\n"
							+ "スクリプトの冒頭部分にデフォルト値記述エリアがありますので、\n"
							+ "自分で書き換えてみるのもいいかもしれません。\n";
	
	//-----------------------------------------------------------------------------------------------------
	//グローバル的な変数
	var G = {
		palette : null,	//初期パネル
		dPalette : null,	//詳細設定パネル
		pPalette : null	//作成シーン指定パネル
	};
	/*=========================================================================================================*/
	//汎用関数
	//-----------------------------------------------------------------------------------------------------
	function getLocalizedMsg() // 言語(日本語or英語)。第1引数がメッセージオブジェクト。第2引数以降の文字列で%n(1～)を置き換える。
	//-----------------------------------------------------------------------------------------------------
	{
		var message = (app.language == Language.JAPANESE) ? arguments[0]["jp"] : arguments[0]["en"];
		for (var i=1; i<arguments.length; i++) {
			message = message.replace("%"+i, arguments[i]);
		}
		return message;
	}
	//-----------------------------------------------------------------------------------------------------
	function throwMsg() //errorをalert。第1引数がメッセージオブジェクト。第2引数以降の文字列で%n(1～)を置き換える。
	//-----------------------------------------------------------------------------------------------------
	{
		alert(getLocalizedMsg.apply(null, arguments), TITLE);
	}
	
	/*=========================================================================================================*/
	//クラス定義
	//-----------------------------------------------------------------------------------------------------
	var SceneManager = function() //シーン管理クラス
	//-----------------------------------------------------------------------------------------------------
	{
		var _sm = this;
		var _comp, _audioLayer, _markers;
		var _maxTime = 0.0, _maxDuration = 0.0; //表示時のゼロパディングに利用。シーンで最大のものに合わせる。
		
		//パレットの入力項目から設定取得
		var _preSec = parseFloat(G.palette.etPre.text);
		var _postSec = parseFloat(G.palette.etPost.text);
		var _durationMode = G.palette.listDur.selection.toString();
		
		//エラーチェック
		_comp = app.project.activeItem;
		if (_comp.selectedLayers.length>1) {
			throwMsg(MANY_LAYERS_ERR);
			return;
		} 
		if (_comp.selectedLayers.length<1) {
			throwMsg(NO_LAYER_ERR);
			return;
		}
		_audioLayer = _comp.selectedLayers[0];
		if (!_audioLayer.hasAudio) {
			throwMsg(NO_LAYER_ERR);
			return;
		}
		_markers = _audioLayer.property("marker");
		if(_markers.numKeys==null){
			throwMsg(NO_MARKER_ERR);
			return;
		}
		
		//scenes作成
		var no = 0;
		var scenes = [];
		for (var i=-1; i<=_markers.numKeys; i++) {
			//無名関数の戻り値としてシーンごとのオブジェクトを取得して配列に格納。戻り値がnullなら無視。
			var scene = (function() {
				var startTime, endTime, preSec, postSec, cmpStartTime, cmpDuration, cmpInPoint, comment;
				var preLimit, postLimit;
				var scene = {};
				
				if (i==0 && _markers.keyTime(1)==_audioLayer.startTime) {
					//最初の0秒マーカーがある場合はマーカー前はスルー
					return null;
				}
				if (i==-1) {
					//iが-1（オーディオレイヤーより手前）は親コンポモードでしかありえない。
					if (_durationMode != '親コンポ' || _audioLayer.startTime <= 0) return null;
				}
				
				if (i==-1) {
					startTime = 0;
				} else if (i==0) {
					startTime = _audioLayer.startTime;
				} else {
					startTime = _markers.keyTime(i);
				}
				
				if (i==-1) {
					endTime =  _audioLayer.startTime;
				} else if (i<_markers.numKeys) {
					endTime = _markers.keyTime(i+1);
				} else {
					endTime = _audioLayer.startTime + _audioLayer.source.duration;
				}
				
				if (startTime == endTime) return null;
				
				if (_durationMode == '親コンポ') {
					//親コンポ基準の場合はコンポの範囲内に収まらないシーンは切り捨てる。端がはみ出たら補正する。
					if (endTime <= 0) return null;
					if (startTime >= _comp.duration)  return null;
					
					if (startTime < 0) startTime = 0;
					if (endTime > _comp.duration) endTime = _comp.duration;
				}
				
				if (_durationMode == '親コンポ') {
					preLimit =  startTime;
					postLimit = _comp.duration - endTime;
				} else {
					preLimit = startTime - _audioLayer.startTime;
					postLimit = _audioLayer.startTime + _audioLayer.source.duration - endTime;
				}
				preSec = (_preSec < preLimit) ? _preSec : preLimit;
				postSec = (_postSec < postLimit) ? _postSec : postLimit;
				
				switch (_durationMode) {
					case 'シーン':
						cmpStartTime = startTime-preSec;
						cmpDuration = endTime-cmpStartTime+postSec;
						cmpInPoint = cmpStartTime;
						break;
					case 'オーディオ':
						cmpStartTime = _audioLayer.startTime;
						cmpDuration = _audioLayer.source.duration;
						cmpInPoint = startTime-preSec;
						break;
					case '親コンポ':
						cmpStartTime = 0;
						cmpDuration = _comp.duration;
						cmpInPoint = startTime-preSec;
						break;
					default:
						alert("なんかおかしい！エラー@sceneNo:"+(no+1));
				}
				
				comment = (0<i && i<=_markers.numKeys) ? _markers.keyValue(i).comment : "";
				
				//桁合わせに利用する最大値を計算。SceneManagerクラスのインスタンス変数に入る。
				if (_maxTime < startTime) _maxTime = startTime;
				if (_maxDuration < endTime-startTime) _maxDuration = endTime-startTime;
				
				//確定した情報をもとにシーンオブジェクト作成
				scene = {
					startTime : startTime,
					endTime : endTime,
					preSec : preSec,
					postSec : postSec,
					cmpStartTime : cmpStartTime,
					cmpDuration : cmpDuration,
					cmpInPoint : cmpInPoint,
					comment : comment
				};
				
				//シーンオブジェクトのメソッド作成。※シーン番号を拘束する必要があるのでwithステートメントを利用
				with ({no:no}) {
					//シーン番号が作成対象かどうかを取得する関数
					scene.shouldMake = function() {
						//個別指定モードでなければ必ずtrueになる
						if (!G.palette.chkParts.value) return true;
						
						var arr = G.pPalette.list.selection;
						var shouldMake = false;
						for (var i=0; i<arr.length; i++) {
							if (arr[i].toString() == (no+1)) {
								shouldMake = true;
								break;
							}
						}
						return shouldMake;
					};
					//シーン番号に対応した子コンポの名前を取得する関数
					scene.getName = function() {
						var name, comment;
						var scene = scenes[no];
						
						//詳細設定パレットから詳細設定取得
						var preComment = (G.dPalette) ? G.dPalette.etPre.text : PRE_COMMENT;
						var postComment = (G.dPalette) ? G.dPalette.etPost.text : POST_COMMENT;
						var format = (G.dPalette) ? G.dPalette.etFormat.text : FORMAT;
						
						//formatをもとにnameを作る
						var digit = (_markers.numKeys+"").length;
						name = format;
						name = name.replace(/\$p/g, _comp.name);
						name = name.replace(/\$i/g, ("0000000000"+(no+1)).slice(-digit));
						
						comment = scene.comment;
						if (comment.length>0) comment = preComment+comment+postComment;
						name = name.replace(/\$c/g, comment);
						
						name = name.replace(/\$t/g, _sm.getTimecode(startTime, true));
						name = name.replace(/\$d/g, _sm.getTimecode(endTime-startTime, false));
						
						return name;
					};
				}
				return scene;
			})();
			//無名関数ここまで
			
			if (scene != null) {
				scenes[no] = scene;
				no++;
			}
		}
		
		//プロパティの設定
		this.isOK = true;
		this.scenes = scenes;
		this.comp = _comp;
		this.audioLayer = _audioLayer;
		
		//timeをあらわすタイムコード文字列を取得する関数
		this.getTimecode = function(time, isStartTime, forceNeedComma) {
			var maxTime = (isStartTime) ? _maxTime : _maxDuration; //最大値。開始時間かデュレーションかで変化
			var frameRate = _comp.frameRate;
			var ret;
			
			var usesTime = (G.dPalette) ? G.dPalette.usesTime : USES_TIME; //タイムコードを使うか、フレーム数を使うか
			var needsComma = (G.dPalette) ? G.dPalette.chkComma.value : NEEDS_COMMA; //小数点以下を使うか
			if (forceNeedComma) needsComma = true;
			
			if (!usesTime) {
				//フレーム数を使う。
				var fs = parseInt(time*frameRate);
				var maxFs = parseInt(maxTime*frameRate);
				ret = ("0000000000"+ fs).slice(-(""+maxFs).length);
			} else {
				var len;
				//秒を使う。
				if (maxTime>=36000) { // >=10:00:00:00
					len = 11;
				} else if (maxTime>=3600) { // >=1:00:00:00
					len = 10;
				} else if (maxTime>=600) { // >=10:00:00
					len = 8;
				} else if (maxTime>=60) { // >=1:00:00
					len = 7;
				} else if (maxTime>=10) { // >=10:00
					len = 5;
				} else { // <= 9:xx
					len = 4;
				}
				
				ret = timeToCurrentFormat(time, frameRate).slice(-len, 8+(time<0)+needsComma*3);
				if (!needsComma) ret += "s";
			}
			if (time<0) ret = "-"+ret;
			return ret;
		};
	};
	
	/*=========================================================================================================*/
	//メインロジック
	/*---------------------------------------------------------------------------------------------------------*/
	function _buildUI(thisObj) //初期表示パネル。ウインドウにもScriptUIにも対応。
	/*---------------------------------------------------------------------------------------------------------*/
	{
		G.palette= (thisObj instanceof Panel) ? thisObj : new Window("palette", "sceneSplitter", undefined, {resizeable: true});
		G.palette.margins  = 6;
		G.palette.alignChildren = 'left';
		
		with(G.palette.add("group") ) {
			orientation = "row";
			add("statictext",undefined, "[Margin(秒)] pre:");
			G.palette.etPre = add("edittext",undefined, "0.0");
			add("statictext",undefined, "  post:");
			G.palette.etPost = add("edittext",undefined, "0.0");
		}
		with (G.palette.add('group')) {
			orientation = 'row';
			add("statictext", undefined, "[Duration基準] ");
			G.palette.listDur = add("dropdownlist",[110,10,210,30],['シーン', 'オーディオ', '親コンポ']);
			G.palette.listDur.selection = DURATION_BASIS;
		}
		
		G.palette.chkParts = G.palette.add("checkbox",undefined,"生成するシーンを指定");
		G.palette.chkParts.value = false;
		
		G.palette.chkFixTime = G.palette.add("checkbox",undefined,"開始タイムコードを親に合わせる");
		G.palette.chkFixTime.value = FIXES_START_TIMECODE;
		
		with (G.palette.add("group")) {
			add("button",undefined,"詳細設定").onClick = _buildDetailUI;
			add("statictext",[0, 0, 10, 15],"");
			add("button",undefined,"実行").onClick = _execute;
		}
	
		//G.palette.add("statictext",undefined, "※オーディオレイヤーにマーカーを打って実行");

		return G.palette;
	}

	/*---------------------------------------------------------------------------------------------------------*/
	function _buildDetailUI() //詳細設定パネル。
	/*---------------------------------------------------------------------------------------------------------*/
	{
		if (G.dPalette) {
			//すでに存在するならそのまま表示
			G.dPalette.show();
			return;
		}
		
		G.dPalette = new Window("palette", "sceneSplitter詳細設定", undefined, {resizeable: true});
		G.dPalette.margins  = 6;
		G.dPalette.alignChildren = 'left';
		
		with (G.dPalette.add("group")) {
			orientation = "row";
			add("statictext",undefined, "[シーン名の書式]　　(");
			add("button",[0, 0, 50,20],"説明").onClick = function() {
				alert(HOW_TO_USE_FORMAT, "シーン名書式の表記法について");
			};
			add("statictext",undefined, ")");
		}
	
		with (G.dPalette.add("group")) {
			orientation = "row";
			add("statictext",undefined, "      ");
			G.dPalette.etFormat =add("edittext",[0, 0, 170, 20], FORMAT);
		}
	
		G.dPalette.add("statictext",undefined, "[シーン名の接頭子・接尾子]");
		with (G.dPalette.add("group")) {
			orientation = "row";
			add("statictext",undefined, "      ");
			G.dPalette.etPre = add("edittext",[0, 0, 40, 20], PRE_COMMENT);
			add("statictext",undefined, "(シーン名)");
			G.dPalette.etPost = add("edittext",[0, 0, 40, 20], POST_COMMENT);
		}
	
		G.dPalette.add("statictext",undefined, "[時間の表記法]");
		with (G.dPalette.add("group")) {
			orientation = "row";
			add("statictext",undefined, "      ");
			with (add("radiobutton",undefined, "タイムコード")) {
				onClick = function() {G.dPalette.usesTime = true;}
				value = USES_TIME;
			}
			with (add("radiobutton",undefined, "フレーム数")) {
				onClick = function() {G.dPalette.usesTime = false;}
				value = !USES_TIME;
			}
		}
		G.dPalette.usesTime = USES_TIME;
		
		with(G.dPalette.add("group")) {
			orientation = "row";
			add("statictext",undefined, "      ");
			G.dPalette.chkComma =add("checkbox",undefined,"コンマ秒を表記");
			G.dPalette.chkComma.value = NEEDS_COMMA;
		}
		
		G.dPalette.show();
	}
	/*---------------------------------------------------------------------------------------------------------*/
	function _buildPartsUI() //生成するシーンを指定するパネル
	/*---------------------------------------------------------------------------------------------------------*/
	{
		if (G.palette instanceof Window) G.palette.close();
		if (G.dPalette) G.dPalette.close();
		
		var sm = new SceneManager();
		if (!sm.isOK) return false;
		
		G.pPalette = new Window("dialog", "sceneSplitter選択", undefined, {resizeable: true});
		G.pPalette.margins  = 6;
		G.pPalette.alignChildren = 'left';
		G.pPalette.list = G.pPalette.add("listbox", undefined, "",
										{numberOfColumns:4, showHeaders:true, multiselect:true,
											columnTitles:["NO", "シーン名", "開始秒","デュレーション"]});
		
		for (var i=0; i<sm.scenes.length; i++) {
			var scene = sm.scenes[i];
			
			with(G.pPalette.list.add("item",i+1)) {
				subItems[0].text = scene.comment;
				subItems[1].text = sm.getTimecode(scene.startTime, true, true);
				subItems[2].text = sm.getTimecode(scene.endTime - scene.startTime, false, true);
			}
		}
		
		with (G.pPalette.add("group")) {
			add("statictext",[0, 0, 170, 15],"※Ctrl, Shiftキーで複数選択");
			add("button",undefined,"実行").onClick = _splitScenes;
		}
		G.pPalette.show();
		
		return true;
	}
	
	/*---------------------------------------------------------------------------------------------------------*/
	function _execute() //実行ボタン押下時に呼ばれるロジック
	/*---------------------------------------------------------------------------------------------------------*/
	{
		var proj = app.project;
		if (!proj){
		   throwMsg(NO_PROJ_ERR);
		   return;
		}
		var comp = proj.activeItem;
		if (!comp || !(comp instanceof CompItem)) {
		   throwMsg(NO_COMP_ERR);
		   return;
		}
		
		if (G.palette.chkParts.value) {
			//作成するシーンを指定するモード
			var builded = _buildPartsUI();
			if (!builded) {
				//エラーが出たので前の画面に戻る
				if (G.palette instanceof Window) G.palette.show();
			}
		} else {
			//全部作っちゃうモード。ダイレクトに_splitScenes()に入る
			_splitScenes();
		}
	}
	
	/*---------------------------------------------------------------------------------------------------------*/
	function _splitScenes() //シーンを分割して子コンポを作成
	/*---------------------------------------------------------------------------------------------------------*/
	{
		if (G.palette instanceof Window) G.palette.close();
		if (G.dPalette) G.dPalette.close();
		if (G.pPalette) G.pPalette.close();
		
		var fixesStartTimecode = G.palette.chkFixTime;
		
		var sm = new SceneManager();
		if (!sm.isOK) return false;
		
		//チェック完了！　UndoGroupを開始し実際のコンポ作成に入る。
		
		app.beginUndoGroup(TITLE);
		
		var compFolder = app.project.items.addFolder("Scenes for "+ sm.audioLayer.name);
		for (var i=0; i<sm.scenes.length; i++) {
			var scene = sm.scenes[i];
			
			if (!scene.shouldMake()) continue;
			
			var sceneComp = compFolder.items.addComp(scene.getName(),
																sm.comp.width,
																sm.comp.height,
																sm.comp.pixelAspect,
																scene.cmpDuration,
																sm.comp.frameRate);
			sceneComp.duration = scene.cmpDuration;
			sceneComp.workAreaStart = scene.cmpInPoint-scene.cmpStartTime;
			var workAreaDuration =  scene.endTime + scene.postSec - scene.cmpInPoint;
			//少数以下の丸め誤差？でエラー出ることがあるので調整
			var workAreaDuration2 = sceneComp.duration - sceneComp.workAreaStart;
			if (workAreaDuration2<workAreaDuration) workAreaDuration = workAreaDuration2;
			sceneComp.workAreaDuration = workAreaDuration;
			
			var compLayer = sm.comp.layers.add(sceneComp);
			compLayer.moveAfter(sm.audioLayer);
			compLayer.startTime = scene.cmpStartTime;
			compLayer.inPoint = scene.cmpInPoint;
			compLayer.outPoint = scene.endTime + scene.postSec;
			compLayer.property("marker").setValueAtTime(scene.startTime, new MarkerValue(""));
			compLayer.property("marker").setValueAtTime(scene.endTime, new MarkerValue(""));
			compLayer.audioEnabled = false;
			
			sm.audioLayer.copyToComp(sceneComp);
			var childAudioLayer = sceneComp.layer(1);
			childAudioLayer.startTime = sm.audioLayer.startTime - scene.cmpStartTime;
			childAudioLayer.inPoint =  compLayer.inPoint - scene.cmpStartTime;
			childAudioLayer.outPoint =  compLayer.outPoint - scene.cmpStartTime;
			
			var childTextLayer = sceneComp.layers.addText("タイムコード");
			var textDoc = childTextLayer.property("ADBE Text Properties").property("ADBE Text Document");
			var newText = textDoc.value;
			newText.resetCharStyle();
			newText.fontSize = sceneComp.width/18; //横幅の1/3くらい
			newText.fillColor = [1, 0, 0];
			newText.strokeColor = [0, 0, 0];
			newText.strokeWidth = 2;
			newText.font = "Arial";
			newText.strokeOverFill = false;
			newText.applyStroke = true;
			newText.applyFill = true;
			newText.justification = ParagraphJustification.RIGHT_JUSTIFY;
			textDoc.setValue(newText);
			childTextLayer.property("Source Text").expression = 'var sTime = '+scene.cmpStartTime+';\rtimeToTimecode(sTime+time)';
			childTextLayer.position.setValue([sceneComp.width-10, sceneComp.width/18]);

			if (fixesStartTimecode && scene.cmpStartTime>0) {
				//startTimeが0を上回る場合のみ、親のタイムコードに合わせる。（マイナスだとエラーになるので）
				sceneComp.displayStartTime = scene.cmpStartTime;
			}
		}
		
		app.endUndoGroup();
	}
	
	/*=========================================================================================================*/
	// START SCRIPT
	if(parseFloat(app.version) >= 7.0)
	{
		_buildUI(parent); //G.palette作成
		if (G.palette instanceof Window){
			//window
			G.palette.show();
		}else{
			//ScriptUI Panel
			G.palette.layout.layout(true);
		}
	}
	else
	{
		alert("This script requires AE7.0 or later.");
	}

})(this);