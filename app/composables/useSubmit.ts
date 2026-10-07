/** payload（JSON）と添付ファイルを multipart で送る。エラーはメッセージの配列にする */
export function useSubmit<T>(url: string) {
  const errors = ref<string[]>([])
  const pending = ref(false)

  async function submit(payload: unknown, file?: File | null): Promise<T | undefined> {
    errors.value = []
    pending.value = true
    const form = new FormData()
    form.append('payload', JSON.stringify(payload))
    if (file) form.append('attachment', file)
    try {
      return await $fetch<T>(url, { method: 'POST', body: form })
    }
    catch (error) {
      errors.value = toMessages(error)
    }
    finally {
      pending.value = false
    }
  }

  return { submit, errors, pending }
}

export function toMessages(error: unknown): string[] {
  const data = (error as { data?: { data?: unknown, message?: string } }).data
  if (Array.isArray(data?.data)) return data.data as string[]
  return [data?.message ?? '送信に失敗しました']
}
