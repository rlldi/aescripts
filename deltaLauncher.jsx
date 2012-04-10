(function(parent){
	/*=========================================================================================================*/
	//デフォルト値設定。好きにいじってね。
	//-----------------------------------------------------------------------------------------------------
	var DEFAULT_FOLDER_NO = 0;
	
	/*=========================================================================================================*/
	//定数
	var NAME = "deltaLauncher.jsx";
	var TITLE = "deltaLauncher.jsx";
	var NO_PROJ_ERR	 	 	 =   {en:"Open a project first.", jp:"プロジェクトを開いて下さい."};
	var NO_COMP_ERR	 	 	 =   {en:"Select a composition.", jp:"コンポジションを選択して下さい."};
	var NO_PROPERTY_ERR	 	 	 =   {en:"Select at least 1 property.", jp:"プロパティを選択して下さい."};
	
	var TYPE_UNDEFINED = 0;
	var TYPE_JSX = 1;
	var TYPE_JSXBIN = 2;
	var TYPE_EXP = 3;
	
	//-----------------------------------------------------------------------------------------------------
	//グローバル的な変数
	var _palette = null;	//パネル
	
	/*=========================================================================================================*/
	//汎用関数
	//-----------------------------------------------------------------------------------------------------
	function loc(msg) // 言語(日本語or英語)
	//-----------------------------------------------------------------------------------------------------
	{
		return app.language == Language.JAPANESE ? msg["jp"] : msg["en"];
	}
	
	//-----------------------------------------------------------------------------------------------------
	function throwMsg(msg) //errorをalert
	//-----------------------------------------------------------------------------------------------------
	{
		alert(loc(msg), TITLE);
	}
	
	/*=========================================================================================================*/
	//クラス定義
	//-----------------------------------------------------------------------------------------------------
	var Item = function(file)
	{
		var _name;
		var _content = "";
		var _isTimeRemap = false;
		
		this.file = file;
		this.loadFile();
	};
	
	//prototypeのメソッド設定
	with (Item.prototypte) {
		getIcon = function() {
			return undefined;
		};
		getType = function() {
		};
		getName = function() {
			return (_name) ? _name : file.name;
		};
		getDescription = function() {
			return (_description) ? _description : undefined;
		};
		loadFile = function() {
			switch (this.getType()) {
				case TYPE_UNDEFINED:
					break;
				case TYPE_JSX:
					eval(_content);
					break;
				case TYPE_JSXBIN:
					break;
				case TYPE_EXP:
					if (properties.length<1) {
						throwMsg(NO_LAYER_ERR);
						return;
					}
					for (var i=0;i<properties.length;i++) {
						if (this.isTimeRemap) 
						properties[i].expression = _content;
					}
					break;
			}
			this.file.open("r");
			while (!this.file.eof)
				_content += this.file.readln() + "\r\n";
			this.file.close();
			
			_name = "hoge";
			_description = "desc";
		};
		execute = function() {
			var layers = app.project.activeItem.selectedLayers;
			var properties = //app.project.activeItem.selectedProperties;
			
			this.loadFile();
			
			switch (this.getType()) {
				case TYPE_UNDEFINED:
					break;
				case TYPE_JSX:
					eval(_content);
					break;
				case TYPE_JSXBIN:
					break;
				case TYPE_EXP:
					if (properties.length<1) {
						throwMsg(NO_PROPERTY_ERR);
						return;
					}
					for (var i=0;i<properties.length;i++) {
						if (_isTimeRemap) ;//タイムリマップ使用可能に
						properties[i].expression = _content;
						//次元を合わせる？
					}
					break;
			}
		};
	}
	
	/*=========================================================================================================*/
	//メインロジック
	/*---------------------------------------------------------------------------------------------------------*/
	function _buildUI(thisObj)
	/*---------------------------------------------------------------------------------------------------------*/
	{
		var folders;
		var _palette = (thisObj instanceof Panel) ? thisObj : new Window("palette", rd_ScriptLauncherData.scriptName, undefined, {resizeable:true});
		_palette.margins  = 6;
		_palette.alignChildren = 'left';
		
		//コンボボックス
		//addlistner
		function() {
			_loadList();
		}
		//リスト
		_palette.list = _palette.add("listbox", undefined, "",
										{numberOfColumns:2, showHeaders:false, multiselect:false,
											columnTitles:["icon", "name"]});
		_loadList();
		
		_pPalette.show();
		
		return true;
	}
	
	/*---------------------------------------------------------------------------------------------------------*/
	function _getItems(dirPath)
	/*---------------------------------------------------------------------------------------------------------*/
	{
		var files = new File(dirPath);
		var items = [], item;
		var no = 0;
		for (var i=0; i<files.length; i++) {
			item = new Item(files[i]);
			if (item.getType() != TYPE_UNDEFINED) {
				items[no] = item;
				no++;
			}
		}
		return items;
	}
	/*---------------------------------------------------------------------------------------------------------*/
	function _loadList()
	/*---------------------------------------------------------------------------------------------------------*/
	{
		var folderName = _palette.combobox.selectedItem;
		_palette.items = _getItems[folderName];
		
		_palette.list.removeAll();
		
		for (var i=0; i<_palette.items.length; i++) {
			var item = _palette.items[i];
			
			with(_palette.list.add("item",i+1)) {
				subItems[0].text = item.getIcon();
				subItems[1].text = item.getName;
			}
		}
	}
	
	/*---------------------------------------------------------------------------------------------------------*/
	function _execute()
	/*---------------------------------------------------------------------------------------------------------*/
	{
		app.beginUndoGroup(TITLE);
		_palette.items[_palette.list.selectedIndex].execute();
		app.endUndoGroup();
	}

	/*=========================================================================================================*/
	// START SCRIPT
	if(parseFloat(app.version) >= 7.0)
	{
		_buildUI(parent); //_palette作成
		if (_palette instanceof Window){
			//window
			_palette.show();
		}else{
			//ScriptUI Panel
			_palette.layout.layout(true);
		}
	}
	else
	{
		alert("This script requires AE7.0 or later.");
	}

})(this);