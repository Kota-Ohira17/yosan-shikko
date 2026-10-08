/**
 * 通販サイトごとの送料無料の基準（2026年10月時点で調べたもの。変わったらここを直す）。
 * freeFrom は「この金額（税込）以上で送料無料」。null は決まった基準がないもの。
 */
export const SHIPPING_RULES: Record<string, { freeFrom: number | null, fee?: number, note: string }> = {
  ASKUL: { freeFrom: 2000, fee: 440, note: '法人会員は税込2,000円以上で配送料無料（未満は440円）' },
  モノタロウ: { freeFrom: 3850, note: '3,500円（税別）以上で送料無料' },
  Amazon: { freeFrom: 3500, fee: 410, note: 'Amazon発送の商品は3,500円以上で配送料無料（未満は410円〜）。プライム会員なら常に無料' },
  楽天: { freeFrom: 3980, note: '送料はショップごとに違う（3,980円以上で無料のショップが多い）' },
  アースダンボール: { freeFrom: null, note: '常に送料無料になる基準はない（期間限定の送料無料キャンペーンあり）' },
}

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

export type ShippingAdvice = {
  /** 送料無料に届いているか（基準がなければ null） */
  free: boolean | null
  /** サイトの送料の決まり */
  note: string
  /** 知らせたいこと（まとめて発注するべきか など） */
  messages: string[]
}

/**
 * 発注1件分の金額と、同じサイトの未対応の発注から、送料についての案内を作る。
 * 決まりを登録していないサイトなら null。
 */
export function shippingAdvice(site: string, amount: number, others: { seq: string, amount: number }[] = []): ShippingAdvice | null {
  const rule = SHIPPING_RULES[site]
  if (!rule) return null
  const messages: string[] = []
  const othersTotal = others.reduce((s, o) => s + o.amount, 0)
  const together = amount + othersTotal

  if (rule.freeFrom == null) {
    if (others.length) messages.push(`同じサイトの未対応の発注が${others.length}件（${others.map(o => o.seq).join('、')}）あります。まとめて発注すると送料を1回分にできます。`)
    return { free: null, note: rule.note, messages }
  }

  const free = amount >= rule.freeFrom
  if (free) {
    messages.push(`${yen(amount)}で送料無料の基準（${yen(rule.freeFrom)}）に届いています。`)
  }
  else {
    messages.push(`${yen(amount)}なので、あと${yen(rule.freeFrom - amount)}で送料無料になります${rule.fee ? `（このままだと送料${yen(rule.fee)}〜）` : ''}。`)
    if (others.length) {
      messages.push(together >= rule.freeFrom
        ? `同じサイトの未対応の発注（${others.map(o => o.seq).join('、')}）とまとめると${yen(together)}になり、送料無料になります。まとめて発注してください。`
        : `同じサイトの未対応の発注（${others.map(o => o.seq).join('、')}）とまとめても${yen(together)}で、送料無料まであと${yen(rule.freeFrom - together)}です。`)
    }
    else {
      messages.push('急ぎでなければ、ほかの発注とまとめるか、必要な物をまとめて買うと送料を節約できます。')
    }
  }
  return { free, note: rule.note, messages }
}
