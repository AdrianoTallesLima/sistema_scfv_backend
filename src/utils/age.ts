type RegistrationCategory =
  | "CHILDREN"
  | "ELDERLY"

type ScfvActivity =
  | "SCFV_0_6"
  | "SCFV_7_15"
  | "SCFV_IDOSOS"

function getBirthDateParts(birthDate: string | Date) {
  if (typeof birthDate === "string") {
    const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)

    if (!match) {
      throw new Error("Data de nascimento inválida.")
    }

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    const date = new Date(Date.UTC(year, month - 1, day))

    const isValidDate =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day

    if (!isValidDate) {
      throw new Error("Data de nascimento inválida.")
    }

    return {
      year,
      month,
      day
    }
  }

  if (Number.isNaN(birthDate.getTime())) {
    throw new Error("Data de nascimento inválida.")
  }

  return {
    year: birthDate.getUTCFullYear(),
    month: birthDate.getUTCMonth() + 1,
    day: birthDate.getUTCDate()
  }
}

export function calculateAge(birthDate: string | Date) {
  const { year, month, day } = getBirthDateParts(birthDate)

  const today = new Date()

  let age = today.getFullYear() - year

  const birthdayHasNotHappened =
    today.getMonth() + 1 < month ||
    (
      today.getMonth() + 1 === month &&
      today.getDate() < day
    )

  if (birthdayHasNotHappened) {
    age--
  }

  if (age < 0) {
    throw new Error(
      "A data de nascimento não pode estar no futuro."
    )
  }

  return age
}

export function determineScfvActivity(
  category: RegistrationCategory,
  birthDate: string | Date
): {
  valid: boolean
  age: number
  activity?: ScfvActivity
  message?: string
} {
  const age = calculateAge(birthDate)

  if (category === "CHILDREN") {
    if (age > 15) {
      return {
        valid: false,
        age,
        message:
          "Não é possível cadastrar como criança um usuário com 16 anos ou mais."
      }
    }

    return {
      valid: true,
      age,
      activity: age <= 6
        ? "SCFV_0_6"
        : "SCFV_7_15"
    }
  }

  if (category === "ELDERLY") {
    if (age < 60) {
      return {
        valid: false,
        age,
        message:
          "A idade mínima para o SCFV para Idosos é 60 anos."
      }
    }

    return {
      valid: true,
      age,
      activity: "SCFV_IDOSOS"
    }
  }

  return {
    valid: false,
    age,
    message: "Atividade proposta inválida."
  }
}

export function shouldDeactivateChildByAge(
  birthDate: string | Date
) {
  return calculateAge(birthDate) >= 16
}
