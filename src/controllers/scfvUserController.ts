import { prisma } from "../db.js"
import { calculateAge, determineScfvActivity } from "../utils/age.js"
import { isValidCpf, normalizeCpf } from "../utils/cpf.js"

export async function createScfvUser(req: any, res: any) {
  try {
    const {
      category,
      name,
      cpf,
      nis,
      birthDate
    } = req.body

    // Campos obrigatórios
    if (
      typeof category !== "string" ||
      typeof name !== "string" ||
      typeof cpf !== "string" ||
      typeof birthDate !== "string" ||
      !name.trim() ||
      !cpf.trim() ||
      !birthDate.trim()
    ) {
      return res.status(400).json({
        message:
          "Atividade proposta, nome, CPF e data de nascimento são obrigatórios."
      })
    }

    // A interface terá somente Crianças ou Idosos
    if (
      category !== "CHILDREN" &&
      category !== "ELDERLY"
    ) {
      return res.status(400).json({
        message: "Atividade proposta inválida."
      })
    }

    const normalizedName = name.trim()
    const normalizedCpf = normalizeCpf(cpf)

    // Validação real do CPF
    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({
        message: "CPF inválido."
      })
    }

    // Impede CPF duplicado
    const existingCpf = await prisma.scfvUser.findUnique({
      where: {
        cpf: normalizedCpf
      }
    })

    if (existingCpf) {
      return res.status(409).json({
        message: "Já existe um usuário cadastrado com este CPF."
      })
    }

    // NIS é opcional
    let normalizedNis: string | null = null

    if (
      nis !== undefined &&
      nis !== null &&
      nis !== ""
    ) {
      if (typeof nis !== "string") {
        return res.status(400).json({
          message: "NIS inválido."
        })
      }

      normalizedNis = nis.replace(/\D/g, "")

      if (normalizedNis.length !== 11) {
        return res.status(400).json({
          message: "O NIS deve possuir 11 dígitos."
        })
      }
    }

    // Calcula idade e determina automaticamente a faixa do SCFV
    let ageResult

    try {
      ageResult = determineScfvActivity(
        category,
        birthDate
      )
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          message: error.message
        })
      }

      return res.status(400).json({
        message: "Data de nascimento inválida."
      })
    }

    if (!ageResult.valid || !ageResult.activity) {
      return res.status(400).json({
        message: ageResult.message
      })
    }

    // O age.ts já validou YYYY-MM-DD.
    // Criamos a data em UTC para evitar deslocamento de dia.
    const birthDateForDatabase = new Date(
      `${birthDate}T00:00:00.000Z`
    )

    const scfvUser = await prisma.scfvUser.create({
      data: {
        activity: ageResult.activity,
        name: normalizedName,
        cpf: normalizedCpf,
        nis: normalizedNis,
        birthDate: birthDateForDatabase,

        createdById: req.session.user.id
      }
    })

    return res.status(201).json({
      message: "Usuário cadastrado com sucesso.",
      user: {
        id: scfvUser.id,
        name: scfvUser.name,
        cpf: scfvUser.cpf,
        nis: scfvUser.nis,
        birthDate: scfvUser.birthDate,
        age: ageResult.age,
        activity: scfvUser.activity,
        active: scfvUser.active
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}

export async function listScfvUsers(req: any, res: any) {
  try {
    const {
      search,
      category,
      activity,
      active,
      missingNis
    } = req.query

    const where: any = {}

    // Busca por nome, CPF ou NIS
    if (typeof search === "string" && search.trim()) {
      const searchText = search.trim()
      const searchDigits = searchText.replace(/\D/g, "")

      where.OR = [
        {
          name: {
            contains: searchText,
            mode: "insensitive"
          }
        }
      ]

      if (searchDigits) {
        where.OR.push(
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
        )
      }
    }

    // Filtro geral: Crianças ou Idosos
    if (category !== undefined) {
      if (
        category !== "CHILDREN" &&
        category !== "ELDERLY"
      ) {
        return res.status(400).json({
          message: "Categoria inválida."
        })
      }

      if (category === "CHILDREN") {
        where.activity = {
          in: [
            "SCFV_0_6",
            "SCFV_7_15"
          ]
        }
      }

      if (category === "ELDERLY") {
        where.activity = "SCFV_IDOSOS"
      }
    }

    // Filtro específico por faixa
    if (activity !== undefined) {
      if (
        activity !== "SCFV_0_6" &&
        activity !== "SCFV_7_15" &&
        activity !== "SCFV_IDOSOS"
      ) {
        return res.status(400).json({
          message: "Atividade SCFV inválida."
        })
      }

      where.activity = activity
    }

    // Ativos ou inativos
    if (active !== undefined) {
      if (
        active !== "true" &&
        active !== "false"
      ) {
        return res.status(400).json({
          message:
            "O filtro de situação selecionado é inválido."
        })
      }

      where.active = active === "true"
    }

    // Usuários com ou sem NIS
    if (missingNis !== undefined) {
      if (
        missingNis !== "true" &&
        missingNis !== "false"
      ) {
        return res.status(400).json({
          message:
            "O filtro de NIS selecionado é inválido."
        })
      }

      where.nis =
        missingNis === "true"
          ? null
          : {
              not: null
            }
    }

    const users = await prisma.scfvUser.findMany({
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

    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      cpf: user.cpf,
      nis: user.nis,
      birthDate: user.birthDate,
      age: calculateAge(user.birthDate),
      activity: user.activity,
      active: user.active,
      inactiveReason: user.inactiveReason,
      createdAt: user.createdAt,

      createdBy: {
        id: user.createdBy.id,
        name: user.createdBy.nome
      }
    }))

    return res.status(200).json({
      total: formattedUsers.length,
      users: formattedUsers
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}