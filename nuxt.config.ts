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
    oauth: {
      google: { clientId: '', clientSecret: '' },
    },
    public: {
      devLogin: false,
    },
  },
})
