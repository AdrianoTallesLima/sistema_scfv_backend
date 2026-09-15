export function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "")
}

export function isValidCpf(cpf: string) {
  const normalizedCpf = normalizeCpf(cpf)

  if (normalizedCpf.length !== 11) {
    return false
  }

  if (/^(\d)\1{10}$/.test(normalizedCpf)) {
    return false
  }

  const calculateDigit = (base: string) => {
    let sum = 0
    let weight = base.length + 1

    for (const digit of base) {
      sum += Number(digit) * weight
      weight--
    }

    const remainder = sum % 11

    return remainder < 2
      ? 0
      : 11 - remainder
  }

  const firstDigit = calculateDigit(
    normalizedCpf.slice(0, 9)
  )

  if (firstDigit !== Number(normalizedCpf[9])) {
    return false
  }

  const secondDigit = calculateDigit(
    normalizedCpf.slice(0, 10)
  )

  return secondDigit === Number(normalizedCpf[10])
}
