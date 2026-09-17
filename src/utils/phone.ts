export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

export function isValidPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone)

  return (
    normalizedPhone.length === 11
  )
}
