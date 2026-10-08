export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/main.css'],
  app: {
    head: { title: '予算執行', htmlAttrs: { lang: 'ja' } },
  },
  $development: {
    // ローカルは http なので、Secure 属性付きの Cookie を捨てるブラウザ（Safari など）でもログインできるようにする
    // @ts-expect-error password は環境変数 NUXT_SESSION_PASSWORD から入るので、ここでは cookie だけ上書きする
    runtimeConfig: { session: { cookie: { secure: false } } },
  },
  runtimeConfig: {
    // 環境変数 NUXT_DATABASE_URL などで上書きする（.env.example 参照）
    databaseUrl: 'file:.data/app.db',
    databaseAuthToken: '',
    adminEmails: '',
    allowedEmailDomain: 'g.ecc.u-tokyo.ac.jp',
    n8nWebhookUrl: '',
    n8nWebhookSecret: '',
    // 決算シートを Google スプレッドシートに書き出すサービスアカウント
    googleServiceAccountEmail: '',
    googleServiceAccountPrivateKey: '',
    // テスト用ログインの合言葉（テスター用と、NUXT_ADMIN_EMAILS の管理者用）
    testLoginCode: '',
    testAdminCode: '',
    oauth: {
      google: { clientId: '', clientSecret: '' },
    },
    public: {
      /** ローカル開発用。合言葉なしで任意のメールでログインできる */
      devLogin: false,
      /** テスト公開用。ECC メール＋合言葉でログインできる */
      testLogin: false,
      /** Google ログインのボタンを出すか（OAuth を設定したら true） */
      googleLogin: false,
      /** 画面上部に出す環境名（例: テスト環境）。空なら出さない */
      envLabel: '',
      /** 振込を対応済みにするとき、選んだ口座の横に出す銀行サイトへのリンク */
      bankLinkSmbc: 'https://www.smbc.co.jp/',
      bankLinkYucho: 'https://www.jp-bank.japanpost.jp/',
    },
  },
})
