# FastGet

(古いAPIエンドポイント使用のため使用不可)

FastGetはFastServerに追加される予定のLOCAL_APIを使ったテスト拡張機能です。これはテスト用でありAPIのエンドポイントの変更や仕様の変更がある可能性があります。


# 改造等について
※このプロジェクトは勝手にGoogleChrome拡張機能にアップロードしないでください。参考にして他のプロジェクトを制作するのはかまいません。丸ごとそのまま配布は避けてください
---

## 特徴

- **FSS 追加ボタンの表示**  
  SpigotMC のリソースページに、プラグインやリソースのダウンロードをより簡単にする FSS ボタンを表示します。

- **動的な言語マップの読み込み**  
  `langs/` フォルダ内の JSON ファイル（例: `index.json`、各言語用マッピングファイル）を読み込み、ページ内のテキストを自動で翻訳または置換

- **コンテンツスクリプトによるカスタマイズ**  
  ページのテキストを動的に操作するため、複数のコンテンツスクリプト（`content.js`、`help.js`、`lang.js`、`logo_replace.js`）を利用

- **カスタム CSS アニメーション**  
  `xpAnimation.css` でアニメーションのCSSを設定

---

## 構成
```
   FastGet/
├── content.js < これメイン的な
├── help.js < 検索ボックスボタン追加
├── lang.js < 日本語化するためのファイル
├── logo_replace.js < ただロゴを置き換えるだけです
├── xpAnimation.css　< 経験値アニメーションのcss
├── manifest.json < Chromeの設定ファイル
├── icon.png <アイコン
├── img/ < 素材
│   ├── spigot.png
│   ├── yt.png
│   ├── google.png
│   └── info.png
└── langs/ >
    ├── index.json < ファイル一覧を記載する場所
    ├── ALL.json < 一旦ここに全て書いてます
    ├── forms.json < 例としてファイルごとに置き換え文字を変えてもいいかと思います
    └── chats.json < 例としてファイルごとに置き換え文字を変えてもいいかと思います


```
## LOCAL_APIについて

- **リクエスト先**  
  FastSererでサーバーコンソールに移動した際に起動: `localhost:4001` 

- **基本的な返事**  
```
レスポンス: "{\"status\": \"true(false)\", \"message\": \"%s\", \"timestamp\": %d, \"uptime\": \"%s\"}"
status: falseの時はエラーメッセージをmessageに含んで返します
```

- **サーバー生存確認**  
```
endpoint: /check_alive
レスポンス: "{\"status\": \"ok\", \"message\": \"Server is running\", \"timestamp\": %d, \"uptime\": \"%s\", \"version\": \"{version}\"}"
```

- **現在テストで使用できるエンドポイント**  
```
/hello_world [Hi! FastServerと返事]
/get_os [os情報を返事]
/get_serverid [現在ターゲットにしているサーバーのIDを返事(プロセスID同等)]
/get_servername [現在ターゲットにしているサーバー名(プロジェクト名)を返事]
/get_serverpath [現在ターゲットにしているサーバーの保存先を返事]
/get_serversoftware [現在ターゲットにしているサーバーのソフトウェアを返事(xxMC)]
/get_serverversion [現在ターゲットにしているサーバーのソフトウェアバージョンを返事(x.y)]
/get_max_ram [現在ターゲットにしているサーバーのMaxRamを返事(string)]
/get_min_ram [現在ターゲットにしているサーバーのMinRamを返事(string)]

＊プラグイン周り＊
/add_fastget (変更予定) [URLを送信することによりプラグイン解析をし成功したらstatus:true]
/check_fastget (変更予定) [現在使用してません]
/remove_fastget (変更予定) [プラグイン解析をし削除成功したらstatus:true]
/list_fastget (変更予定) [プラグインフォルダを解析しlistを返事]
/check_jarfile [URLを送信し持っているかチェック存在したら{name}.jar]
```



