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

export async function getScfvUserById(req: any, res: any) {
  try {
    const userId = Number(req.params.id)

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        message: "ID de usuário inválido."
      })
    }

    const user = await prisma.scfvUser.findUnique({
      where: {
        id: userId
      },

      select: {
        id: true,
        activity: true,
        name: true,
        cpf: true,
        nis: true,
        birthDate: true,
        photoPath: true,

        active: true,
        deactivationType: true,
        inactiveReason: true,
        inactiveAt: true,

        createdAt: true,
        updatedAt: true,

        createdBy: {
          select: {
            id: true,
            nome: true
          }
        },

        updatedBy: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({
        message: "Usuário não encontrado."
      })
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        cpf: user.cpf,
        nis: user.nis,
        birthDate: user.birthDate,
        age: calculateAge(user.birthDate),
        activity: user.activity,
        photoPath: user.photoPath,

        active: user.active,
        deactivationType: user.deactivationType,
        inactiveReason: user.inactiveReason,
        inactiveAt: user.inactiveAt,

        createdAt: user.createdAt,
        updatedAt: user.updatedAt,

        createdBy: {
          id: user.createdBy.id,
          name: user.createdBy.nome
        },

        updatedBy: user.updatedBy
          ? {
              id: user.updatedBy.id,
              name: user.updatedBy.nome
            }
          : null
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}

export async function updateScfvUser(req: any, res: any) {
  try {
    const userId = Number(req.params.id)

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        message: "ID de usuário inválido."
      })
    }

    const existingUser = await prisma.scfvUser.findUnique({
      where: {
        id: userId
      }
    })

    if (!existingUser) {
      return res.status(404).json({
        message: "Usuário não encontrado."
      })
    }

    const {
      category,
      name,
      cpf,
      nis,
      birthDate
    } = req.body

    // Categoria atual caso ela não seja enviada
    const currentCategory =
      existingUser.activity === "SCFV_IDOSOS"
        ? "ELDERLY"
        : "CHILDREN"

    const finalCategory =
      category !== undefined
        ? category
        : currentCategory

    if (
      finalCategory !== "CHILDREN" &&
      finalCategory !== "ELDERLY"
    ) {
      return res.status(400).json({
        message: "Atividade proposta inválida."
      })
    }

    // Nome
    let finalName = existingUser.name

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          message: "Nome inválido."
        })
      }

      finalName = name.trim()
    }

    // CPF
    let finalCpf = existingUser.cpf

    if (cpf !== undefined) {
      if (typeof cpf !== "string") {
        return res.status(400).json({
          message: "CPF inválido."
        })
      }

      const normalizedCpf = normalizeCpf(cpf)

      if (!isValidCpf(normalizedCpf)) {
        return res.status(400).json({
          message: "CPF inválido."
        })
      }

      const cpfInUse = await prisma.scfvUser.findFirst({
        where: {
          cpf: normalizedCpf,
          NOT: {
            id: userId
          }
        }
      })

      if (cpfInUse) {
        return res.status(409).json({
          message: "Já existe um usuário cadastrado com este CPF."
        })
      }

      finalCpf = normalizedCpf
    }

    // NIS
    let finalNis = existingUser.nis

    if (nis !== undefined) {
      if (
        nis === null ||
        nis === ""
      ) {
        finalNis = null
      } else {
        if (typeof nis !== "string") {
          return res.status(400).json({
            message: "NIS inválido."
          })
        }

        const normalizedNis = nis.replace(/\D/g, "")

        if (normalizedNis.length !== 11) {
          return res.status(400).json({
            message: "O NIS deve possuir 11 dígitos."
          })
        }

        finalNis = normalizedNis
      }
    }

    // Data de nascimento
    let finalBirthDate: string | Date =
      existingUser.birthDate

    if (birthDate !== undefined) {
      if (
        typeof birthDate !== "string" ||
        !birthDate.trim()
      ) {
        return res.status(400).json({
          message: "Data de nascimento inválida."
        })
      }

      finalBirthDate = birthDate
    }

    // Recalcula idade e atividade
    let ageResult

    try {
      ageResult = determineScfvActivity(
        finalCategory,
        finalBirthDate
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

    const birthDateForDatabase =
      typeof finalBirthDate === "string"
        ? new Date(
            `${finalBirthDate}T00:00:00.000Z`
          )
        : finalBirthDate

    const user = await prisma.scfvUser.update({
      where: {
        id: userId
      },

      data: {
        name: finalName,
        cpf: finalCpf,
        nis: finalNis,
        birthDate: birthDateForDatabase,
        activity: ageResult.activity,

        updatedById: req.session.user.id
      }
    })

    return res.status(200).json({
      message: "Cadastro atualizado com sucesso.",

      user: {
        id: user.id,
        name: user.name,
        cpf: user.cpf,
        nis: user.nis,
        birthDate: user.birthDate,
        age: ageResult.age,
        activity: user.activity,
        active: user.active
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}