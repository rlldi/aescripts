/*
	Name: Cut Allocator
	Version: 0.1 (20111007)
	Author: rlldi @ Deltasphere
*/

(function() {
	/*=============================================================================================*/
	//定数
	var TITLE = "Cut Allocator";
	var NO_PROJ_ERR = {jp:"プロジェクトを開いて下さい"};
	var PARSE_ERR = {jp:"以下のファイル(%1個)の命名規則が正しくないため無視しました。\n%2"};
	var LAYER_ERR = {jp:"ファイル %1 で、同じカットNoのファイルとは別の秒数が指定されているため中断しました。"};
	var TIME_ERR = {jp:"ファイル %1 で前のカットより手前の秒数が指定されているため中断しました。"};
	var FINISHED_MSG= {jp:"%1個のカットを、シーン「%2」として取り込みました。"};
	
	var SCENE_DURATION = 300; //秒で指定
	var FRAME_RATE = 30;
	//-----------------------------------------------------------------------------------------------------
	//グローバル的な変数
	var _nullItem;
	
	/*=============================================================================================*/
	//関数
	//-----------------------------------------------------------------------------------------------------
	function getLocalizedMsg() // 言語(日本語or英語)。第1引数がメッセージオブジェクト。第2引数以降の文字列で%n(1～)を置き換える。
	//-----------------------------------------------------------------------------------------------------
	{
		//var message = (app.language == Language.JAPANESE) ? arguments[0]["jp"] : arguments[0]["en"];
		var message = arguments[0]["jp"];
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
	var CutLayer = function(file) //カット内レイヤー管理クラス { cutNo, name, startTime, layerID, footage }
	//-----------------------------------------------------------------------------------------------------
	{
		this.name = decodeURI(file.name);
		
		var _cutNo;
		var _startTime;
		var _layerID;
		var _footage;
		var matches, sels;
		
		//(6-1)ファイル名を解析。
		//命名規則("カットナンバー_mm-ss-ff_レイヤID")に基づいて、カットNo, 開始時間を取得。
		matches = file.name.match(/(\d+)_(\d\d)\-(\d\d)\-(\d\d)_([A-Z]).*\.png/i);
		if (!matches) {
			//パースエラー
			this.isParsed = false;
			return;
		}
		
		_cutNo = matches[1];
		_startTime = parseInt(matches[2]-0)*60 + parseInt(matches[3]) + parseInt(matches[4])/FRAME_RATE;
		//alert(matches[2]+"*60+"+matches[3]+"+"+matches[4]+"/"+FRAME_RATE+"="+_startTime);
		_layerID = matches[5];
		
		this.isParsed = true;
		
		//インポート
		_footage = app.project.importFile(new ImportOptions(file));
		if (_footage.mainSource.hasAlpha) {
			_footage.mainSource.guessAlphaMode();
		}
		
		//プロパティ設定
		this.cutNo = _cutNo;
		this.startTime = _startTime;
		this.layerID = _layerID;
		this.footage = _footage;
	}
	//-----------------------------------------------------------------------------------------------------
	var Cut = function(firstCutLayer, sceneFolderItem) //カット管理クラス { cutNo, startTime, folderItem, comp, layers[], boolean push(), applyCompSetting() }
	//-----------------------------------------------------------------------------------------------------
	{
		var _comp;
		var _folderItem;
		var _cutLayers = [];
		
		//プロジェクトパネルでのフォルダ作成
		_folderItem = app.project.items.addFolder("Cut" + firstCutLayer.cutNo + "_レイヤー");
		_folderItem.parentFolder = sceneFolderItem;
		
		//カットコンポ作成
		_comp = sceneFolderItem.items.addComp("Cut" + firstCutLayer.cutNo, firstCutLayer.width , firstCutLayer.height, 1.0, 10, FRAME_RATE);
		
		//プロパティ設定
		this.cutNo = firstCutLayer.cutNo;
		this.startTime = firstCutLayer.startTime;
		this.folderItem = _folderItem;
		this.comp = _comp;
		this.push = function(cutLayer) //レイヤー追加メソッド
		{
			if (cutLayer.cutNo == _cutNo && cutLayer.startTime == _startTime) {
				cutLayer.footage.parentFolder = _folderItem;
				_cutLayers.push(cutLayer);
				return true;
			} else {
				return false;
			}
		}
		this.applyCompSetting = function(nextCut, sceneComp) //設定適用メソッド
		{
			var offsetX, offsetY, pos, duration, layers, layer, nullLayer;
			
			duration = (nextCut != null) ? nextCut.startTime-_startTime : sceneComp.duration-_startTime;
			
			if (duration<=0) return false;
			
			//(6-3)カットコンポについて設定を行う。
			offsetX = (_comp.width - sceneComp.width)/2;
			offsetY = (_comp.height - sceneComp.height)/2;
			
			_comp.width = sceneComp.width;
			_comp.height = sceneComp.height;
			_comp.displayStartTime = _startTime;
			_comp.duration = duration;
			
			_cutLayers.sort(function(a,b){
				return b.layerID.charCodeAt(0) - a.layerID.charCodeAt(0);
			});
			
			for (var i=0; i<_cutLayers.length; i++) {
				layer = _comp.layers.add(_cutLayers[i]);
				layer.property("position").setValue([pos[0]-offsetX, pos[1]-offsetY]);
				layer.threeDLayer = true;
				layer.outPoint = duration;
			}
			/*
			for (var i=1; i<=_comp.numLayers; i++) {
				pos = _comp.layer(i).property("position").value;
				//alert(pos.toString() + "=>" +[pos[0]-offsetX, pos[1]-offsetY].toString());
				_comp.layer(i).property("position").setValue([pos[0]-offsetX, pos[1]-offsetY]);
				_comp.layer(i).threeDLayer = true;
				_comp.layer(i).outPoint = duration;
			}*/
			
			layers = _comp.layers;
			
			//(6-4)カットコンポに操作用のレイヤーを配置。
			//調整シェイプレイヤ作成 by bryful
			layer = (function (layers) {
				var sl = layers.addShape();
				sl.name = "調整レイヤ";
				var rct = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Shape - Rect");
				rct.name = "rect";
				
				//サイズをあわせるエクスプレッション
				rct.property("ADBE Vector Rect Size").expression = "[thisComp.width,thisComp.height];";
				rct.property("ADBE Vector Rect Position").expression = "[0,0];";
				rct.property("ADBE Vector Rect Roundness").expression = "0;";
				
				sl.property("ADBE Transform Group").property("ADBE Anchor Point").expression = "[0,0];";
				sl.property("ADBE Transform Group").property("ADBE Position").expression = "[thisComp.width/2, thisComp.height/2];";
				
				var fil = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Graphic - Fill");
				fil.name = "fill";
				fil.property("ADBE Vector Fill Color").setValue( [1,1,1] );
				sl.adjustmentLayer = true;
				
				return sl;
			})(layers);
			
			//カメラ親のヌルレイヤ作成
			if (_nullItem == null) {
				layer = layers.addNull();
				_nullItem = layer.source;
				_nullItem.name = sceneComp.name + "用カメラヌル";
			} else {
				layer = layers.add(_nullItem);
			}
			layer.name = "カメラヌルレイヤ";
			layer.threeDLayer = true;
			pos = layer.property("position").value;
			layer.property("position").setValue([pos[0],pos[1],-1000]);
			nullLayer = layer;
			
			//カメラ
			layer = layers.addCamera("カメラ 1", [0,0]);
			layer.parent = nullLayer;
			layer.property("position").setValue([0,0,0]);
			layer.property("pointOfInterest").setValue([0,0,100]);
			
			//(6-6)取得した開始時間に従って、シーンコンポにカットコンポを設置。
			layer = sceneComp.layers.add(_comp);
			layer.startTime = _startTime;
			
			return true;
		}
		
		this.push(firstCutLayer); //firstCutLayerもまずは追加
	}
	/*=========================================================================================================*/
	//-----------------------------------------------------------------------------------------------------
	var execute = function()
	//-----------------------------------------------------------------------------------------------------
	{
		var cuts = {};
		var folder, folderItem, sceneName, sceneComp;
		var files, cutLayer, cut, nextCut, result;
		var errors;
		
		//前提エラーチェック
		if (!app.project){
		   throwMsg(NO_PROJ_ERR);
		   return;
		}
		
		//フォルダ指定
		folder = Folder.selectDialog("シーンとして取り込むフォルダを指定");
		if (folder == null) return;
		
		sceneName = encodeURI(folder.name);
		
		//-----------------------------------------↓↓↓↓↓↓
		app.beginUndoGroup(TITLE);
		
		//プロジェクトパネルでのフォルダ作成
		folderItem = app.project.items.addFolder(sceneName + "_comp");
		
		//シーンコンポ作成
		sceneComp = folderItem.items.addComp(sceneName, 1024, 576, 1.0, SCENE_DURATION, FRAME_RATE);
		
		//カット読込
		files = folder.getFiles("*.png");
		for (var i=0; i<files.length; i++) {
			cutLayer = new CutLayer(files[i]);
			
			//パース失敗してたらエラーとして記録して無視
			if (!cutLayer.isParsed) {
				errors.push(cutLayer.name);
				cuntinue;
			}
			if (!cuts[cutLayer.layerID]) {
				cuts[cutLayer.layerID] = new Cut(cutLayer);
			} else {
				result = cuts[cutLayer.layerID].push(cutLayer);
				if (!result) {
					//ファイル名の記述違いがあるので強制終了
					throwMsg(LAYER_ERR, cutLayer.name);
					break;
				}
			}
		}
		
		//カットごとに処理を行う
		if (result) {
			for (var i=0; i<cuts.length; i++) {
				cut = cuts[i];
				nextCut = (i<cuts.length) ? cuts[i+1] : null;
				result = cut.applyCompSetting(nextCut, sceneComp);
				if (!result) {
					//ファイルがおかしいので強制終了
					throwMsg(TIME_ERR, cut.name);
					break;
				}
			}
		}
		app.endUndoGroup();
		//-----------------------------------------↑↑↑↑↑↑
		
		//終了レポート
		if (result) {
			throwMsg(FINISHED_MSG, cuts.length, sceneName);
			if (errors.length>0) {
				throwMsg(PARSE_ERR, errors.length, errors.join("\n"));
			}
		}
	}
	/*=============================================================================================*/
	//スクリプト開始
	//-----------------------------------------------------------------------------------------------------
	
	/*
	　※余力があったらUI Panel作る。
	*/
	execute();
	
})();