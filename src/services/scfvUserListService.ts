import { prisma } from "../db.js"
import { calculateAge } from "../utils/age.js"

export class ScfvUserListValidationError extends Error {}

function categoryFromActivity(activity: string) {
  return activity === "SCFV_IDOSOS"
    ? "ELDERLY"
    : "CHILDREN"
}

export async function getFilteredScfvUsers(query: any) {
  const {
    search,
    category,
    activity,
    active,
    missingNis,
    age,
    birthdayMonth
  } = query

  const where: any = {}

  // BUSCA POR NOME, CPF OU NIS
  if (
    typeof search === "string" &&
    search.trim()
  ) {
    const searchText = search.trim()

    const isDocumentSearch =
      /^[\d.\-\s]+$/.test(searchText)

    if (isDocumentSearch) {
      const searchDigits =
        searchText.replace(/\D/g, "")

      where.OR = [
        {
          cpf: {
            contains: searchDigits
          }
        },
        {
          nis: {
            contains: searchDigits
          }
        }
      ]
    } else {
      where.name = {
        contains: searchText,
        mode: "insensitive"
      }
    }
  }

  // CATEGORIA
  if (
    category !== undefined &&
    category !== "CHILDREN" &&
    category !== "ELDERLY"
  ) {
    throw new ScfvUserListValidationError(
      "Categoria inválida."
    )
  }

  // FAIXA / ATIVIDADE
  if (
    activity !== undefined &&
    activity !== "SCFV_0_6" &&
    activity !== "SCFV_7_15" &&
    activity !== "SCFV_IDOSOS"
  ) {
    throw new ScfvUserListValidationError(
      "Atividade SCFV inválida."
    )
  }

  // COMBINAÇÕES INCOMPATÍVEIS
  if (
    category === "CHILDREN" &&
    activity === "SCFV_IDOSOS"
  ) {
    throw new ScfvUserListValidationError(
      "A faixa selecionada não pertence à categoria Crianças."
    )
  }

  if (
    category === "ELDERLY" &&
    activity !== undefined &&
    activity !== "SCFV_IDOSOS"
  ) {
    throw new ScfvUserListValidationError(
      "A faixa selecionada não pertence à categoria Idosos."
    )
  }

  if (activity !== undefined) {
    where.activity = activity
  } else if (category === "CHILDREN") {
    where.activity = {
      in: [
        "SCFV_0_6",
        "SCFV_7_15"
      ]
    }
  } else if (category === "ELDERLY") {
    where.activity = "SCFV_IDOSOS"
  }

  // ATIVOS / INATIVOS
  if (active !== undefined) {
    if (
      active !== "true" &&
      active !== "false"
    ) {
      throw new ScfvUserListValidationError(
        "O filtro de situação selecionado é inválido."
      )
    }

    where.active = active === "true"
  }

  // COM OU SEM NIS
  if (missingNis !== undefined) {
    if (
      missingNis !== "true" &&
      missingNis !== "false"
    ) {
      throw new ScfvUserListValidationError(
        "O filtro de NIS selecionado é inválido."
      )
    }

    where.nis =
      missingNis === "true"
        ? null
        : {
            not: null
          }
  }

  // IDADE
  let ageFilter: number | null = null

  if (age !== undefined) {
    if (
      typeof age !== "string" ||
      !/^\d+$/.test(age)
    ) {
      throw new ScfvUserListValidationError(
        "O filtro de idade selecionado é inválido."
      )
    }

    ageFilter = Number(age)

    if (
      ageFilter < 0 ||
      ageFilter > 130
    ) {
      throw new ScfvUserListValidationError(
        "A idade deve estar entre 0 e 130 anos."
      )
    }
  }

  // MÊS DE ANIVERSÁRIO
  let birthdayMonthFilter:
    number | null = null

  if (birthdayMonth !== undefined) {
    if (
      typeof birthdayMonth !== "string" ||
      !/^\d+$/.test(birthdayMonth)
    ) {
      throw new ScfvUserListValidationError(
        "O mês de aniversário selecionado é inválido."
      )
    }

    birthdayMonthFilter =
      Number(birthdayMonth)

    if (
      birthdayMonthFilter < 1 ||
      birthdayMonthFilter > 12
    ) {
      throw new ScfvUserListValidationError(
        "O mês de aniversário deve estar entre 1 e 12."
      )
    }
  }

  const users =
    await prisma.scfvUser.findMany({
      where,

      orderBy: {
        name: "asc"
      },

      select: {
        id: true,
        activity: true,
        name: true,
        cpf: true,
        nis: true,
        birthDate: true,
        active: true,
        inactiveReason: true,
        createdAt: true,

        createdBy: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

  let formattedUsers =
    users.map((user) => ({
      id: user.id,

      category:
        categoryFromActivity(
          user.activity
        ),

      name: user.name,
      cpf: user.cpf,
      nis: user.nis,

      birthDate:
        user.birthDate,

      age:
        calculateAge(
          user.birthDate
        ),

      activity:
        user.activity,

      active:
        user.active,

      inactiveReason:
        user.inactiveReason,

      createdAt:
        user.createdAt,

      createdBy: {
        id: user.createdBy.id,
        name: user.createdBy.nome
      }
    }))

  if (ageFilter !== null) {
    formattedUsers =
      formattedUsers.filter(
        (user) =>
          user.age === ageFilter
      )
  }

  if (
    birthdayMonthFilter !== null
  ) {
    formattedUsers =
      formattedUsers.filter(
        (user) =>
          user.birthDate.getUTCMonth() + 1 ===
          birthdayMonthFilter
      )
  }

  return {
    users: formattedUsers,

    filters: {
      search:
        typeof search === "string" &&
        search.trim()
          ? search.trim()
          : null,

      category:
        category ?? null,

      activity:
        activity ?? null,

      active:
        active === undefined
          ? null
          : active === "true",

      missingNis:
        missingNis === undefined
          ? null
          : missingNis === "true",

      age:
        ageFilter,

      birthdayMonth:
        birthdayMonthFilter
    }
  }
}