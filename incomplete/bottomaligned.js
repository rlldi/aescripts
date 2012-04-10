//改行コードを除いて指定文字数分文字列を切り出す関数
String.prototype.substrWoR = function(c){
	var n=1,o=0;
	while(o!=n){
		s=this.substr(0,c+(o=n)-1);
		n=s.split("\r").length;
	}
	return s;
}

h=30; //1行の高さ
c=(ピックウィップでテキストレイヤーのアニメータの「開始」を指定);
txt=text.sourceText.substrWoR(c);

 position+[
 	0,
 	(txt.split("\r").length-1)*h
 ];