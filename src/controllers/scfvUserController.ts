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

    const existingUser =
      await prisma.scfvUser.findUnique({
        where: {
          id: userId
        },

        include: {
          childProfile: {
            include: {
              responsible: true
            }
          },

          elderlyProfile: true
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
      birthDate,
      phone,
      address,
      childProfile,
      elderlyProfile
    } = req.body

    const currentCategory =
      existingUser.activity === "SCFV_IDOSOS"
        ? "ELDERLY"
        : "CHILDREN"

    // O tipo da ficha não pode ser trocado
    // durante uma simples edição.
    if (category !== undefined) {
      if (
        category !== "CHILDREN" &&
        category !== "ELDERLY"
      ) {
        return res.status(400).json({
          message: "Atividade proposta inválida."
        })
      }

      if (category !== currentCategory) {
        return res.status(400).json({
          message:
            "Não é possível alterar o público do cadastro entre Crianças e Idosos."
        })
      }
    }

    // Evita envio de perfil incompatível.
    if (
      currentCategory === "CHILDREN" &&
      elderlyProfile !== undefined &&
      elderlyProfile !== null
    ) {
      return res.status(400).json({
        message:
          "Dados de idoso não podem ser informados em um cadastro de criança."
      })
    }

    if (
      currentCategory === "ELDERLY" &&
      childProfile !== undefined &&
      childProfile !== null
    ) {
      return res.status(400).json({
        message:
          "Dados de criança não podem ser informados em um cadastro de idoso."
      })
    }

    // NOME
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

      const normalizedCpf =
        normalizeCpf(cpf)

      if (!isValidCpf(normalizedCpf)) {
        return res.status(400).json({
          message: "CPF inválido."
        })
      }

      const cpfInUse =
        await prisma.scfvUser.findFirst({
          where: {
            cpf: normalizedCpf,

            NOT: {
              id: userId
            }
          }
        })

      if (cpfInUse) {
        return res.status(409).json({
          message:
            "Já existe um usuário cadastrado com este CPF."
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

        const normalizedNis =
          nis.replace(/\D/g, "")

        if (normalizedNis.length !== 11) {
          return res.status(400).json({
            message:
              "O NIS deve possuir 11 dígitos."
          })
        }

        finalNis = normalizedNis
      }
    }

    // DATA DE NASCIMENTO
    let finalBirthDate: string | Date =
      existingUser.birthDate

    if (birthDate !== undefined) {
      if (
        typeof birthDate !== "string" ||
        !birthDate.trim()
      ) {
        return res.status(400).json({
          message:
            "Data de nascimento inválida."
        })
      }

      finalBirthDate = birthDate
    }

    // CELULAR
    let finalPhone = existingUser.phone

    if (phone !== undefined) {
      if (
        typeof phone !== "string" ||
        !phone.trim()
      ) {
        return res.status(400).json({
          message: "Celular inválido."
        })
      }

      const normalizedPhone =
        normalizePhone(phone)

      if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({
          message:
            "Celular inválido. Informe um número com DDD."
        })
      }

      finalPhone = normalizedPhone
    }

    // ENDEREÇO
    let finalAddress = existingUser.address

    if (address !== undefined) {
      if (
        typeof address !== "string" ||
        !address.trim()
      ) {
        return res.status(400).json({
          message: "Endereço inválido."
        })
      }

      const normalizedAddress =
        address.trim()

      if (
        normalizedAddress.length > 200
      ) {
        return res.status(400).json({
          message:
            "O endereço deve possuir no máximo 200 caracteres."
        })
      }

      finalAddress = normalizedAddress
    }

    // Recalcula idade e faixa.
    let ageResult

    try {
      ageResult = determineScfvActivity(
        currentCategory,
        finalBirthDate
      )
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          message: error.message
        })
      }

      return res.status(400).json({
        message:
          "Data de nascimento inválida."
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

    const birthDateForDatabase =
      typeof finalBirthDate === "string"
        ? new Date(
          `${finalBirthDate}T00:00:00.000Z`
        )
        : finalBirthDate

    // Auxiliar para campos opcionais.
    const normalizeOptionalText = (
      value: any,
      currentValue:
        string | null | undefined,
      maxLength: number,
      label: string
    ) => {
      if (value === undefined) {
        return {
          value: currentValue ?? null,
          error: null
        }
      }

      if (
        value === null ||
        value === ""
      ) {
        return {
          value: null,
          error: null
        }
      }

      if (typeof value !== "string") {
        return {
          value: null,
          error: `${label} inválido.`
        }
      }

      const normalized = value.trim()

      if (!normalized) {
        return {
          value: null,
          error: null
        }
      }

      if (
        normalized.length > maxLength
      ) {
        return {
          value: null,
          error:
            `${label} deve possuir no máximo ${maxLength} caracteres.`
        }
      }

      return {
        value: normalized,
        error: null
      }
    }

    let normalizedChildProfile: any = null

    if (
      currentCategory === "CHILDREN" &&
      childProfile !== undefined
    ) {
      if (
        !childProfile ||
        typeof childProfile !== "object" ||
        Array.isArray(childProfile)
      ) {
        return res.status(400).json({
          message:
            "Dados da ficha da criança inválidos."
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

      const currentResponsible =
        existingUser.childProfile
          ?.responsible

      let finalResponsibleName =
        currentResponsible?.name ?? null

      let finalResponsibleCpf =
        currentResponsible?.cpf ?? null

      let finalResponsiblePhone =
        currentResponsible?.phone ?? null

      if (responsible !== undefined) {
        if (
          !responsible ||
          typeof responsible !== "object" ||
          Array.isArray(responsible)
        ) {
          return res.status(400).json({
            message:
              "Dados do responsável inválidos."
          })
        }

        if (responsible.name !== undefined) {
          if (
            typeof responsible.name !==
            "string" ||
            !responsible.name.trim()
          ) {
            return res.status(400).json({
              message:
                "Nome do responsável inválido."
            })
          }

          finalResponsibleName =
            responsible.name.trim()
        }

        if (responsible.cpf !== undefined) {
          if (
            typeof responsible.cpf !==
            "string"
          ) {
            return res.status(400).json({
              message:
                "CPF do responsável inválido."
            })
          }

          const normalizedResponsibleCpf =
            normalizeCpf(
              responsible.cpf
            )

          if (
            !isValidCpf(
              normalizedResponsibleCpf
            )
          ) {
            return res.status(400).json({
              message:
                "CPF do responsável inválido."
            })
          }

          finalResponsibleCpf =
            normalizedResponsibleCpf
        }

        if (
          responsible.phone !== undefined
        ) {
          if (
            typeof responsible.phone !==
            "string" ||
            !responsible.phone.trim()
          ) {
            return res.status(400).json({
              message:
                "Celular do responsável inválido."
            })
          }

          const normalizedResponsiblePhone =
            normalizePhone(
              responsible.phone
            )

          if (
            !isValidPhone(
              normalizedResponsiblePhone
            )
          ) {
            return res.status(400).json({
              message:
                "Celular do responsável inválido."
            })
          }

          finalResponsiblePhone =
            normalizedResponsiblePhone
        }
      }

      if (
        !finalResponsibleName ||
        !finalResponsibleCpf ||
        !finalResponsiblePhone
      ) {
        return res.status(400).json({
          message:
            "Nome, CPF e celular do responsável são obrigatórios."
        })
      }

      if (
        finalResponsibleCpf === finalCpf
      ) {
        return res.status(400).json({
          message:
            "O CPF do responsável deve ser diferente do CPF da criança."
        })
      }

      let finalRelationship =
        existingUser.childProfile
          ?.relationship

      if (relationship !== undefined) {
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

        finalRelationship = relationship
      }

      if (!finalRelationship) {
        return res.status(400).json({
          message:
            "Informe a relação do responsável com a criança."
        })
      }

      let finalRelationshipOther =
        existingUser.childProfile
          ?.relationshipOther ?? null

      if (
        finalRelationship === "OUTRO"
      ) {
        if (
          relationshipOther !== undefined
        ) {
          if (
            typeof relationshipOther !==
            "string" ||
            !relationshipOther.trim()
          ) {
            return res.status(400).json({
              message:
                "Informe qual é a relação do responsável com a criança."
            })
          }

          finalRelationshipOther =
            relationshipOther.trim()

          if (
            finalRelationshipOther.length >
            50
          ) {
            return res.status(400).json({
              message:
                "A relação com o responsável deve possuir no máximo 50 caracteres."
            })
          }
        }

        if (!finalRelationshipOther) {
          return res.status(400).json({
            message:
              "Informe qual é a relação do responsável com a criança."
          })
        }
      } else {
        finalRelationshipOther = null
      }

      const schoolResult =
        normalizeOptionalText(
          school,
          existingUser.childProfile?.school,
          150,
          "Escola"
        )

      if (schoolResult.error) {
        return res.status(400).json({
          message: schoolResult.error
        })
      }

      const gradeResult =
        normalizeOptionalText(
          grade,
          existingUser.childProfile?.grade,
          50,
          "Série"
        )

      if (gradeResult.error) {
        return res.status(400).json({
          message: gradeResult.error
        })
      }

      const classResult =
        normalizeOptionalText(
          schoolClass,
          existingUser.childProfile
            ?.schoolClass,
          50,
          "Turma"
        )

      if (classResult.error) {
        return res.status(400).json({
          message: classResult.error
        })
      }

      const attendanceResult =
        normalizeOptionalText(
          schoolAttendance,
          existingUser.childProfile
            ?.schoolAttendance,
          100,
          "Frequência escolar"
        )

      if (attendanceResult.error) {
        return res.status(400).json({
          message:
            attendanceResult.error
        })
      }

      normalizedChildProfile = {
        responsible: {
          name: finalResponsibleName,
          cpf: finalResponsibleCpf,
          phone: finalResponsiblePhone
        },

        relationship:
          finalRelationship,

        relationshipOther:
          finalRelationshipOther,

        school: schoolResult.value,
        grade: gradeResult.value,

        schoolClass:
          classResult.value,

        schoolAttendance:
          attendanceResult.value
      }
    }

    let normalizedElderlyProfile: any =
      null

    if (
      currentCategory === "ELDERLY" &&
      elderlyProfile !== undefined
    ) {
      if (
        !elderlyProfile ||
        typeof elderlyProfile !== "object" ||
        Array.isArray(elderlyProfile)
      ) {
        return res.status(400).json({
          message:
            "Dados da ficha do idoso inválidos."
        })
      }

      const {
        situation,
        observations
      } = elderlyProfile

      const situationResult =
        normalizeOptionalText(
          situation,
          existingUser.elderlyProfile
            ?.situation,
          200,
          "Situação"
        )

      if (situationResult.error) {
        return res.status(400).json({
          message: situationResult.error
        })
      }

      let finalObservations =
        existingUser.elderlyProfile
          ?.observations ?? null

      if (observations !== undefined) {
        if (
          observations === null ||
          observations === ""
        ) {
          finalObservations = null
        } else {
          if (
            typeof observations !==
            "string"
          ) {
            return res.status(400).json({
              message:
                "Observações inválidas."
            })
          }

          finalObservations =
            observations.trim() || null
        }
      }

      normalizedElderlyProfile = {
        situation:
          situationResult.value,

        observations:
          finalObservations
      }
    }

    const updatedUser =
      await prisma.$transaction(
        async (tx) => {
          await tx.scfvUser.update({
            where: {
              id: userId
            },

            data: {
              name: finalName,
              cpf: finalCpf,
              nis: finalNis,

              birthDate:
                birthDateForDatabase,

              activity,
              phone: finalPhone,
              address: finalAddress,

              updatedById:
                req.session.user.id
            }
          })

          if (
            currentCategory ===
            "CHILDREN" &&
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

            await tx.childProfile.upsert({
              where: {
                scfvUserId: userId
              },

              update: {
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
              },

              create: {
                scfvUserId: userId,

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
          }

          if (
            currentCategory ===
            "ELDERLY" &&
            normalizedElderlyProfile
          ) {
            await tx.elderlyProfile.upsert({
              where: {
                scfvUserId: userId
              },

              update: {
                situation:
                  normalizedElderlyProfile
                    .situation,

                observations:
                  normalizedElderlyProfile
                    .observations
              },

              create: {
                scfvUserId: userId,

                situation:
                  normalizedElderlyProfile
                    .situation,

                observations:
                  normalizedElderlyProfile
                    .observations
              }
            })
          }

          return tx.scfvUser.findUnique({
            where: {
              id: userId
            },

            include: {
              childProfile: {
                include: {
                  responsible: true
                }
              },

              elderlyProfile: true
            }
          })
        }
      )

    if (!updatedUser) {
      return res.status(404).json({
        message: "Usuário não encontrado."
      })
    }

    return res.status(200).json({
      message:
        "Cadastro atualizado com sucesso.",

      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        cpf: updatedUser.cpf,
        nis: updatedUser.nis,

        birthDate:
          updatedUser.birthDate,

        age:
          calculateAge(
            updatedUser.birthDate
          ),

        activity:
          updatedUser.activity,

        phone: updatedUser.phone,
        address: updatedUser.address,
        active: updatedUser.active,

        childProfile:
          updatedUser.childProfile
            ? {
              id:
                updatedUser
                  .childProfile.id,

              relationship:
                updatedUser
                  .childProfile
                  .relationship,

              relationshipOther:
                updatedUser
                  .childProfile
                  .relationshipOther,

              school:
                updatedUser
                  .childProfile.school,

              grade:
                updatedUser
                  .childProfile.grade,

              schoolClass:
                updatedUser
                  .childProfile
                  .schoolClass,

              schoolAttendance:
                updatedUser
                  .childProfile
                  .schoolAttendance,

              responsible: {
                id:
                  updatedUser
                    .childProfile
                    .responsible.id,

                name:
                  updatedUser
                    .childProfile
                    .responsible.name,

                cpf:
                  updatedUser
                    .childProfile
                    .responsible.cpf,

                phone:
                  updatedUser
                    .childProfile
                    .responsible.phone
              }
            }
            : null,

        elderlyProfile:
          updatedUser.elderlyProfile
            ? {
              id:
                updatedUser
                  .elderlyProfile.id,

              situation:
                updatedUser
                  .elderlyProfile
                  .situation,

              observations:
                updatedUser
                  .elderlyProfile
                  .observations
            }
            : null
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
