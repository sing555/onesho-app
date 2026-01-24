# ぴかぴかモーニング (Pika-Pika Morning)

4歳の男の子向け、おねしょ記録PWAアプリ。

## 使い方
1. 朝起きたら、おねしょがなかったら「☀️ ぴかぴか！」、あったら「☁️ おもらし...」を押します。
2. 「☀️ ぴかぴか！」を押すと紙吹雪が舞ってお祝いされます！
3. カレンダーで今月の頑張りを確認できます。

## 技術スタック
- HTML5, CSS3, JavaScript
- PWA (Service Worker, Web App Manifest)
- [canvas-confetti](https://github.com/catdad/canvas-confetti)

## GitHubへのアップロード方法
1. GitHubで新しいリポジトリを作成します（例: `onesho-app`）。
2. 以下のコマンドを実行してアップロードします：

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/onesho-app.git
git push -u origin main
```

## GitHub Pagesでの公開
1. リポジトリの Settings > Pages を開きます。
2. Build and deployment の Source を `Deploy from a branch` に設定します。
3. Branch を `main` にして Save します。
4. 数分待つと、URLが発行され、スマホのブラウザで開けるようになります！
