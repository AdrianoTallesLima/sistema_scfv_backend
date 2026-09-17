import { prisma } from "../db.js"
import { calculateAge, determineScfvActivity } from "../utils/age.js"
import { isValidCpf, normalizeCpf } from "../utils/cpf.js"
import { isValidPhone, normalizePhone } from "../utils/phone.js"

export async function createScfvUser(req: any, res: any) {
  try {
    const {
      category,
      name,
      cpf,
      nis,
      birthDate,
      phone,
      address,
      childProfile,
      elderlyProfile
    } = req.body

    // DADOS COMUNS OBRIGATÓRIOS
    if (
      typeof category !== "string" ||
      typeof name !== "string" ||
      typeof cpf !== "string" ||
      typeof birthDate !== "string" ||
      typeof phone !== "string" ||
      typeof address !== "string" ||
      !name.trim() ||
      !cpf.trim() ||
      !birthDate.trim() ||
      !phone.trim() ||
      !address.trim()
    ) {
      return res.status(400).json({
        message:
          "Atividade proposta, nome, CPF, data de nascimento, telefone e endereço são obrigatórios."
      })
    }

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
    const normalizedPhone = normalizePhone(phone)
    const normalizedAddress = address.trim()

    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({
        message: "CPF inválido."
      })
    }

    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({
        message:
          "Telefone inválido. Informe um número com DDD."
      })
    }

    if (normalizedAddress.length > 200) {
      return res.status(400).json({
        message:
          "O endereço deve possuir no máximo 200 caracteres."
      })
    }

    // IMPEDE CPF DUPLICADO
    const existingCpf = await prisma.scfvUser.findUnique({
      where: {
        cpf: normalizedCpf
      }
    })

    if (existingCpf) {
      return res.status(409).json({
        message:
          "Já existe um usuário cadastrado com este CPF."
      })
    }

    // NIS OPCIONAL
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
          message:
            "O NIS deve possuir 11 dígitos."
        })
      }
    }

    // IDADE E FAIXA SCFV
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

    if (
      !ageResult.valid ||
      !ageResult.activity
    ) {
      return res.status(400).json({
        message: ageResult.message
      })
    }

    const activity = ageResult.activity

    const birthDateForDatabase = new Date(
      `${birthDate}T00:00:00.000Z`
    )

    // DADOS ESPECÍFICOS DA CRIANÇA
    let normalizedChildProfile: any = null

    if (category === "CHILDREN") {
      if (
        !childProfile ||
        typeof childProfile !== "object" ||
        Array.isArray(childProfile)
      ) {
        return res.status(400).json({
          message:
            "Os dados da ficha da criança são obrigatórios."
        })
      }

      const {
        responsible,
        relationship,
        relationshipOther,
        school,
        grade,
        schoolClass,
        schoolAttendance
      } = childProfile

      if (
        !responsible ||
        typeof responsible !== "object" ||
        Array.isArray(responsible)
      ) {
        return res.status(400).json({
          message:
            "Os dados do responsável são obrigatórios."
        })
      }

      const {
        name: responsibleName,
        cpf: responsibleCpf,
        phone: responsiblePhone
      } = responsible

      if (
        typeof responsibleName !== "string" ||
        typeof responsibleCpf !== "string" ||
        typeof responsiblePhone !== "string" ||
        !responsibleName.trim() ||
        !responsibleCpf.trim() ||
        !responsiblePhone.trim()
      ) {
        return res.status(400).json({
          message:
            "Nome, CPF e telefone do responsável são obrigatórios."
        })
      }

      const normalizedResponsibleCpf =
        normalizeCpf(responsibleCpf)

      const normalizedResponsiblePhone =
        normalizePhone(responsiblePhone)

      if (
        !isValidCpf(normalizedResponsibleCpf)
      ) {
        return res.status(400).json({
          message:
            "CPF do responsável inválido."
        })
      }

      if (
        normalizedResponsibleCpf ===
        normalizedCpf
      ) {
        return res.status(400).json({
          message:
            "O CPF do responsável deve ser diferente do CPF da criança."
        })
      }

      if (
        !isValidPhone(
          normalizedResponsiblePhone
        )
      ) {
        return res.status(400).json({
          message:
            "Telefone do responsável inválido."
        })
      }

      if (
        relationship !== "PAI" &&
        relationship !== "MAE" &&
        relationship !== "OUTRO"
      ) {
        return res.status(400).json({
          message:
            "Relação com o responsável inválida."
        })
      }

      let normalizedRelationshipOther:
        string | null = null

      if (relationship === "OUTRO") {
        if (
          typeof relationshipOther !== "string" ||
          !relationshipOther.trim()
        ) {
          return res.status(400).json({
            message:
              "Informe qual é a relação do responsável com a criança."
          })
        }

        normalizedRelationshipOther =
          relationshipOther.trim()

        if (
          normalizedRelationshipOther.length >
          50
        ) {
          return res.status(400).json({
            message:
              "A relação com o responsável deve possuir no máximo 50 caracteres."
          })
        }
      }

      const schoolFields = [
        {
          label: "Escola",
          value: school,
          maxLength: 150
        },
        {
          label: "Série",
          value: grade,
          maxLength: 50
        },
        {
          label: "Turma",
          value: schoolClass,
          maxLength: 50
        },
        {
          label: "Frequência escolar",
          value: schoolAttendance,
          maxLength: 100
        }
      ]

      for (const field of schoolFields) {
        if (
          field.value === undefined ||
          field.value === null ||
          field.value === ""
        ) {
          continue
        }

        if (typeof field.value !== "string") {
          return res.status(400).json({
            message: `${field.label} inválido.`
          })
        }

        if (
          field.value.trim().length >
          field.maxLength
        ) {
          return res.status(400).json({
            message:
              `${field.label} deve possuir no máximo ${field.maxLength} caracteres.`
          })
        }
      }

      const normalizeSchoolField = (
        value: any
      ) => {
        if (typeof value !== "string") {
          return null
        }

        const normalized = value.trim()

        return normalized || null
      }

      normalizedChildProfile = {
        responsible: {
          name: responsibleName.trim(),
          cpf: normalizedResponsibleCpf,
          phone: normalizedResponsiblePhone
        },

        relationship,
        relationshipOther:
          normalizedRelationshipOther,

        school:
          normalizeSchoolField(school),

        grade:
          normalizeSchoolField(grade),

        schoolClass:
          normalizeSchoolField(schoolClass),

        schoolAttendance:
          normalizeSchoolField(
            schoolAttendance
          )
      }
    }
    // DADOS ESPECÍFICOS DO IDOSO
    let normalizedElderlyProfile: any = null

    if (category === "ELDERLY") {
      if (
        !elderlyProfile ||
        typeof elderlyProfile !== "object" ||
        Array.isArray(elderlyProfile)
      ) {
        return res.status(400).json({
          message:
            "Os dados da ficha do idoso são obrigatórios."
        })
      }

      const {
        situation,
        observations
      } = elderlyProfile

      let normalizedSituation:
        string | null = null

      if (
        situation !== undefined &&
        situation !== null &&
        situation !== ""
      ) {
        if (typeof situation !== "string") {
          return res.status(400).json({
            message: "Situação inválida."
          })
        }

        normalizedSituation =
          situation.trim()

        if (
          normalizedSituation.length > 200
        ) {
          return res.status(400).json({
            message:
              "A situação deve possuir no máximo 200 caracteres."
          })
        }
      }

      let normalizedObservations:
        string | null = null

      if (
        observations !== undefined &&
        observations !== null &&
        observations !== ""
      ) {
        if (
          typeof observations !== "string"
        ) {
          return res.status(400).json({
            message:
              "Observações inválidas."
          })
        }

        normalizedObservations =
          observations.trim() || null
      }

      normalizedElderlyProfile = {
        situation: normalizedSituation,
        observations:
          normalizedObservations
      }
    }

    // TRANSAÇÃO:
    // ou salva a ficha inteira,
    // ou não salva nada.
    const result = await prisma.$transaction(
      async (tx) => {
        const scfvUser =
          await tx.scfvUser.create({
            data: {
              activity,

              name: normalizedName,
              cpf: normalizedCpf,
              nis: normalizedNis,

              birthDate:
                birthDateForDatabase,

              phone: normalizedPhone,
              address:
                normalizedAddress,

              createdById:
                req.session.user.id
            }
          })

        if (
          category === "CHILDREN" &&
          normalizedChildProfile
        ) {
          const responsible =
            await tx.responsible.upsert({
              where: {
                cpf:
                  normalizedChildProfile
                    .responsible.cpf
              },

              update: {
                name:
                  normalizedChildProfile
                    .responsible.name,

                phone:
                  normalizedChildProfile
                    .responsible.phone
              },

              create: {
                name:
                  normalizedChildProfile
                    .responsible.name,

                cpf:
                  normalizedChildProfile
                    .responsible.cpf,

                phone:
                  normalizedChildProfile
                    .responsible.phone
              }
            })

          const profile =
            await tx.childProfile.create({
              data: {
                scfvUserId:
                  scfvUser.id,

                responsibleId:
                  responsible.id,

                relationship:
                  normalizedChildProfile
                    .relationship,

                relationshipOther:
                  normalizedChildProfile
                    .relationshipOther,

                school:
                  normalizedChildProfile
                    .school,

                grade:
                  normalizedChildProfile
                    .grade,

                schoolClass:
                  normalizedChildProfile
                    .schoolClass,

                schoolAttendance:
                  normalizedChildProfile
                    .schoolAttendance
              }
            })

          return {
            scfvUser,
            childProfile: {
              ...profile,

              responsible: {
                id: responsible.id,
                name: responsible.name,
                cpf: responsible.cpf,
                phone: responsible.phone
              }
            },

            elderlyProfile: null
          }
        }

        const profile =
          await tx.elderlyProfile.create({
            data: {
              scfvUserId:
                scfvUser.id,

              situation:
                normalizedElderlyProfile
                  .situation,

              observations:
                normalizedElderlyProfile
                  .observations
            }
          })

        return {
          scfvUser,
          childProfile: null,
          elderlyProfile: profile
        }
      }
    )

    return res.status(201).json({
      message:
        "Usuário cadastrado com sucesso.",

      user: {
        id: result.scfvUser.id,
        name: result.scfvUser.name,
        cpf: result.scfvUser.cpf,
        nis: result.scfvUser.nis,
        birthDate:
          result.scfvUser.birthDate,

        age: ageResult.age,
        activity:
          result.scfvUser.activity,

        phone:
          result.scfvUser.phone,

        address:
          result.scfvUser.address,

        active:
          result.scfvUser.active,

        childProfile:
          result.childProfile,

        elderlyProfile:
          result.elderlyProfile
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message:
        "Erro interno do servidor."
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
        phone: true,
        address: true,
        photoPath: true,

        active: true,
        deactivationType: true,
        inactiveReason: true,
        inactiveAt: true,

        createdAt: true,
        updatedAt: true,

        childProfile: {
          select: {
            id: true,
            relationship: true,
            relationshipOther: true,
            school: true,
            grade: true,
            schoolClass: true,
            schoolAttendance: true,

            responsible: {
              select: {
                id: true,
                name: true,
                cpf: true,
                phone: true
              }
            }
          }
        },

        elderlyProfile: {
          select: {
            id: true,
            situation: true,
            observations: true
          }
        },

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

        phone: user.phone,
        address: user.address,
        photoPath: user.photoPath,

        active: user.active,
        deactivationType: user.deactivationType,
        inactiveReason: user.inactiveReason,
        inactiveAt: user.inactiveAt,

        childProfile: user.childProfile,
        elderlyProfile: user.elderlyProfile,

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

export async function changeScfvUserStatus(req: any, res: any) {
  try {
    const userId = Number(req.params.id)
    const { active, reason } = req.body

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        message: "ID de usuário inválido."
      })
    }

    if (typeof active !== "boolean") {
      return res.status(400).json({
        message: "Situação do usuário inválida."
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

    // INATIVAÇÃO MANUAL
    if (active === false) {
      if (
        typeof reason !== "string" ||
        !reason.trim()
      ) {
        return res.status(400).json({
          message:
            "Informe o motivo da inativação."
        })
      }

      const normalizedReason = reason.trim()

      if (normalizedReason.length > 100) {
        return res.status(400).json({
          message:
            "O motivo da inativação deve possuir no máximo 100 caracteres."
        })
      }

      const user = await prisma.scfvUser.update({
        where: {
          id: userId
        },

        data: {
          active: false,
          deactivationType: "MANUAL",
          inactiveReason: normalizedReason,
          inactiveAt: new Date(),

          updatedById: req.session.user.id
        }
      })

      return res.status(200).json({
        message: "Usuário inativado com sucesso.",

        user: {
          id: user.id,
          name: user.name,
          active: user.active,
          deactivationType: user.deactivationType,
          inactiveReason: user.inactiveReason,
          inactiveAt: user.inactiveAt
        }
      })
    }

    // REATIVAÇÃO

    const age = calculateAge(existingUser.birthDate)

    const isChildActivity =
      existingUser.activity === "SCFV_0_6" ||
      existingUser.activity === "SCFV_7_15"

    if (isChildActivity && age >= 16) {
      return res.status(400).json({
        message:
          "Não é possível reativar um usuário que atingiu o limite de idade do SCFV."
      })
    }

    const user = await prisma.scfvUser.update({
      where: {
        id: userId
      },

      data: {
        active: true,
        deactivationType: null,
        inactiveReason: null,
        inactiveAt: null,

        updatedById: req.session.user.id
      }
    })

    return res.status(200).json({
      message: "Usuário reativado com sucesso.",

      user: {
        id: user.id,
        name: user.name,
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
