import { prisma } from "../db.js"
import { calculateAge, determineScfvActivity } from "../utils/age.js"
import { isValidCpf, normalizeCpf } from "../utils/cpf.js"
import { isValidPhone, normalizePhone } from "../utils/phone.js"
import { getFilteredScfvUsers, ScfvUserListValidationError } from "../services/scfvUserListService.ts"
import path from "node:path"
import fs from "node:fs/promises"

class ValidationError extends Error {}

const RESPONSIBLE_RELATIONSHIPS = [
  "PAI",
  "MAE",
  "OUTRO",
  "SEM_PARENTESCO"
]

const SEX_VALUES = [
  "MALE",
  "FEMALE"
]

const ACTIVITY_SHIFT_VALUES = [
  "MORNING",
  "AFTERNOON"
]

const PRIORITY_REASON_VALUES = [
  "ISOLATION",
  "CHILD_LABOR",
  "VIOLENCE_OR_NEGLECT",
  "OUT_OF_SCHOOL_OR_GRADE_DELAY",
  "INSTITUTIONAL_CARE",
  "SOCIOEDUCATIONAL_MEASURE",
  "SEXUAL_ABUSE_OR_EXPLOITATION",
  "ECA_PROTECTION_MEASURES",
  "STREET_SITUATION",
  "DISABILITY_VULNERABILITY"
]

function hasField(object: any, field: string) {
  return Object.prototype.hasOwnProperty.call(object, field)
}

function requireText(value: any, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${label} é obrigatório.`)
  }

  return value.trim()
}

function optionalText(
  value: any,
  label: string,
  maxLength?: number
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${label} inválido.`)
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  if (
    maxLength !== undefined &&
    normalized.length > maxLength
  ) {
    throw new ValidationError(
      `${label} deve possuir no máximo ${maxLength} caracteres.`
    )
  }

  return normalized
}

function optionalBoolean(value: any, label: string) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  if (typeof value !== "boolean") {
    throw new ValidationError(`${label} inválido.`)
  }

  return value
}

function normalizeNisValue(value: any, label = "NIS") {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${label} inválido.`)
  }

  const normalized = value.replace(/\D/g, "")

  if (normalized.length !== 11) {
    throw new ValidationError(
      `${label} deve possuir 11 dígitos.`
    )
  }

  return normalized
}

function normalizePhoneValue(
  value: any,
  label: string,
  required = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      throw new ValidationError(`${label} é obrigatório.`)
    }

    return null
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${label} inválido.`)
  }

  const normalized = normalizePhone(value)

  if (!isValidPhone(normalized)) {
    throw new ValidationError(
      `${label} inválido. Informe um número com DDD.`
    )
  }

  return normalized
}

function normalizeZipCode(value: any) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  if (typeof value !== "string") {
    throw new ValidationError("CEP inválido.")
  }

  const normalized = value.replace(/\D/g, "")

  if (normalized.length !== 8) {
    throw new ValidationError(
      "O CEP deve possuir 8 dígitos."
    )
  }

  return normalized
}

function normalizeSex(value: any) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  if (
    typeof value !== "string" ||
    !SEX_VALUES.includes(value)
  ) {
    throw new ValidationError("Sexo inválido.")
  }

  return value
}

function normalizeActivityShift(value: any) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  if (
    typeof value !== "string" ||
    !ACTIVITY_SHIFT_VALUES.includes(value)
  ) {
    throw new ValidationError(
      "Turno da atividade inválido."
    )
  }

  return value
}

function normalizePriorityReasons(value: any) {
  if (
    value === undefined ||
    value === null
  ) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(
      "As situações prioritárias são inválidas."
    )
  }

  const uniqueValues = [...new Set(value)]

  for (const reason of uniqueValues) {
    if (
      typeof reason !== "string" ||
      !PRIORITY_REASON_VALUES.includes(reason)
    ) {
      throw new ValidationError(
        "Foi informada uma situação prioritária inválida."
      )
    }
  }

  return uniqueValues
}

function normalizeOptionalDate(value: any, label: string) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${label} inválida.`)
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    throw new ValidationError(
      `${label} deve estar no formato AAAA-MM-DD.`
    )
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(Date.UTC(year, month - 1, day))

  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day

  if (!valid) {
    throw new ValidationError(`${label} inválida.`)
  }

  return date
}

function categoryFromActivity(activity: string) {
  return activity === "SCFV_IDOSOS"
    ? "ELDERLY"
    : "CHILDREN"
}

async function getDetailedScfvUser(userId: number) {
  return prisma.scfvUser.findUnique({
    where: {
      id: userId
    },

    include: {
      childProfile: {
        include: {
          responsible: true
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
}

function formatDetailedScfvUser(user: any) {
  const category = categoryFromActivity(user.activity)

  return {
    id: user.id,
    category,
    activity: user.activity,

    name: user.name,
    cpf: user.cpf,
    nis: user.nis,
    birthDate: user.birthDate,
    age: calculateAge(user.birthDate),

    identityNumber: user.identityNumber,
    birthplace: user.birthplace,
    sex: user.sex,

    phone:
      category === "ELDERLY"
        ? user.phone
        : null,

    hasDisability: user.hasDisability,
    disabilityDetails: user.disabilityDetails,

    hasAllergy: user.hasAllergy,
    allergyDetails: user.allergyDetails,

    receivesBpc: user.receivesBpc,

    isLiterate: user.isLiterate,
    educationNotes: user.educationNotes,

    activityShift: user.activityShift,

    address: user.address,
    neighborhood: user.neighborhood,
    zipCode: user.zipCode,
    referencePoint: user.referencePoint,

    isPriority: user.isPriority,
    priorityReasons: user.priorityReasons,

    referralOriginAgency:
      user.referralOriginAgency,
    referralDocumentType:
      user.referralDocumentType,
    referralDocumentNumber:
      user.referralDocumentNumber,
    referralDate:
      user.referralDate,

    familyMembersInfo:
      user.familyMembersInfo,
    observations:
      user.observations,

    participatesOtherService:
      user.participatesOtherService,
    otherServiceDetails:
      user.otherServiceDetails,

    photoPath: user.photoPath,

    active: user.active,
    deactivationType:
      user.deactivationType,
    inactiveReason:
      user.inactiveReason,
    inactiveAt:
      user.inactiveAt,

    childProfile:
      user.childProfile
        ? {
            id: user.childProfile.id,

            motherName:
              user.childProfile.motherName,
            fatherName:
              user.childProfile.fatherName,

            relationship:
              user.childProfile.relationship,
            relationshipOther:
              user.childProfile.relationshipOther,

            school:
              user.childProfile.school,
            grade:
              user.childProfile.grade,
            schoolShift:
              user.childProfile.schoolShift,

            receivesBolsaFamilia:
              user.childProfile.receivesBolsaFamilia,
            familyResponsibleName:
              user.childProfile.familyResponsibleName,
            familyNis:
              user.childProfile.familyNis,

            responsible: {
              id:
                user.childProfile.responsible.id,
              name:
                user.childProfile.responsible.name,
              cpf:
                user.childProfile.responsible.cpf,
              phone:
                user.childProfile.responsible.phone
            }
          }
        : null,

    createdAt: user.createdAt,
    updatedAt: user.updatedAt,

    createdBy: {
      id: user.createdBy.id,
      name: user.createdBy.nome
    },

    updatedBy:
      user.updatedBy
        ? {
            id: user.updatedBy.id,
            name: user.updatedBy.nome
          }
        : null
  }
}

function normalizeConditionalDetails(
  flag: boolean | null,
  details: string | null,
  message: string
) {
  if (flag === true && !details) {
    throw new ValidationError(message)
  }

  return flag === true
    ? details
    : null
}

export async function createScfvUser(req: any, res: any) {
  try {
    const body = req.body ?? {}

    const category = body.category

    if (
      category !== "CHILDREN" &&
      category !== "ELDERLY"
    ) {
      throw new ValidationError(
        "Tipo de usuário inválido."
      )
    }

    const name = requireText(
      body.name,
      "Nome"
    )

    const cpfText = requireText(
      body.cpf,
      "CPF"
    )

    const cpf = normalizeCpf(cpfText)

    if (!isValidCpf(cpf)) {
      throw new ValidationError("CPF inválido.")
    }

    const birthDate = requireText(
      body.birthDate,
      "Data de nascimento"
    )

    let ageResult

    try {
      ageResult = determineScfvActivity(
        category,
        birthDate
      )
    } catch (error) {
      if (error instanceof Error) {
        throw new ValidationError(error.message)
      }

      throw new ValidationError(
        "Data de nascimento inválida."
      )
    }

    if (
      !ageResult.valid ||
      !ageResult.activity
    ) {
      throw new ValidationError(
        ageResult.message ??
        "Data de nascimento inválida."
      )
    }

    const activity = ageResult.activity

    const existingCpf =
      await prisma.scfvUser.findUnique({
        where: {
          cpf
        }
      })

    if (existingCpf) {
      return res.status(409).json({
        message:
          "Já existe um usuário cadastrado com este CPF."
      })
    }

    const nis = normalizeNisValue(body.nis)

    const identityNumber = optionalText(
      body.identityNumber,
      "Carteira de identidade",
      30
    )

    const birthplace = optionalText(
      body.birthplace,
      "Naturalidade",
      120
    )

    const sex = normalizeSex(body.sex)

    const phone =
      category === "ELDERLY"
        ? normalizePhoneValue(
            body.phone,
            "Telefone para contato"
          )
        : null

    const hasDisability = optionalBoolean(
      body.hasDisability,
      "Deficiência ou dificuldade de aprendizagem"
    )

    let disabilityDetails = optionalText(
      body.disabilityDetails,
      "Descrição da deficiência ou dificuldade",
      200
    )

    disabilityDetails = normalizeConditionalDetails(
      hasDisability,
      disabilityDetails,
      "Informe qual é a deficiência ou dificuldade de aprendizagem."
    )

    const hasAllergy = optionalBoolean(
      body.hasAllergy,
      "Alergia"
    )

    let allergyDetails = optionalText(
      body.allergyDetails,
      "Descrição da alergia",
      200
    )

    allergyDetails = normalizeConditionalDetails(
      hasAllergy,
      allergyDetails,
      "Informe qual é a alergia do usuário."
    )

    const receivesBpc = optionalBoolean(
      body.receivesBpc,
      "Benefício do BPC"
    )

    const isLiterate = optionalBoolean(
      body.isLiterate,
      "Grau de instrução"
    )

    const educationNotes = optionalText(
      body.educationNotes,
      "Observação do grau de instrução",
      200
    )

    const activityShift =
      normalizeActivityShift(body.activityShift)

    const address = optionalText(
      body.address,
      "Endereço",
      200
    )

    const neighborhood = optionalText(
      body.neighborhood,
      "Bairro",
      100
    )

    const zipCode = normalizeZipCode(
      body.zipCode
    )

    const referencePoint = optionalText(
      body.referencePoint,
      "Ponto de referência",
      200
    )

    const isPriority = optionalBoolean(
      body.isPriority,
      "Situação prioritária"
    )

    let priorityReasons = normalizePriorityReasons(
      body.priorityReasons
    )

    if (isPriority === true) {
      if (priorityReasons.length === 0) {
        throw new ValidationError(
          "Selecione ao menos uma situação prioritária."
        )
      }
    } else {
      priorityReasons = []
    }

    const referralOriginAgency = optionalText(
      body.referralOriginAgency,
      "Órgão de origem",
      150
    )

    const referralDocumentType = optionalText(
      body.referralDocumentType,
      "Tipo de documento do encaminhamento",
      30
    )

    const referralDocumentNumber = optionalText(
      body.referralDocumentNumber,
      "Número do documento do encaminhamento",
      30
    )

    const referralDate = normalizeOptionalDate(
      body.referralDate,
      "Data do encaminhamento"
    )

    const familyMembersInfo = optionalText(
      body.familyMembersInfo,
      "Informações sobre membros da família"
    )

    const observations = optionalText(
      body.observations,
      "Observações"
    )

    const participatesOtherService =
      optionalBoolean(
        body.participatesOtherService,
        "Participação em outro serviço"
      )

    let otherServiceDetails = optionalText(
      body.otherServiceDetails,
      "Outro serviço",
      200
    )

    otherServiceDetails = normalizeConditionalDetails(
      participatesOtherService,
      otherServiceDetails,
      "Informe de qual outro serviço o usuário participa."
    )

    let normalizedChildProfile: any = null

    if (category === "CHILDREN") {
      const childProfile = body.childProfile

      if (
        !childProfile ||
        typeof childProfile !== "object" ||
        Array.isArray(childProfile)
      ) {
        throw new ValidationError(
          "Os dados da ficha da criança são obrigatórios."
        )
      }

      const responsible = childProfile.responsible

      if (
        !responsible ||
        typeof responsible !== "object" ||
        Array.isArray(responsible)
      ) {
        throw new ValidationError(
          "Os dados do responsável são obrigatórios."
        )
      }

      const responsibleName = requireText(
        responsible.name,
        "Nome do responsável"
      )

      const responsibleCpfText = requireText(
        responsible.cpf,
        "CPF do responsável"
      )

      const responsibleCpf = normalizeCpf(
        responsibleCpfText
      )

      if (!isValidCpf(responsibleCpf)) {
        throw new ValidationError(
          "CPF do responsável inválido."
        )
      }

      if (responsibleCpf === cpf) {
        throw new ValidationError(
          "O CPF do responsável deve ser diferente do CPF da criança."
        )
      }

      const responsiblePhone = normalizePhoneValue(
        responsible.phone,
        "Telefone do responsável",
        true
      )

      const relationship = childProfile.relationship

      if (
        typeof relationship !== "string" ||
        !RESPONSIBLE_RELATIONSHIPS.includes(
          relationship
        )
      ) {
        throw new ValidationError(
          "Parentesco com o responsável inválido."
        )
      }

      let relationshipOther = optionalText(
        childProfile.relationshipOther,
        "Especificação do parentesco",
        50
      )

      if (relationship === "OUTRO") {
        if (!relationshipOther) {
          throw new ValidationError(
            "Especifique o parentesco do responsável."
          )
        }
      } else {
        relationshipOther = null
      }

      normalizedChildProfile = {
        motherName: optionalText(
          childProfile.motherName,
          "Nome da mãe",
          150
        ),

        fatherName: optionalText(
          childProfile.fatherName,
          "Nome do pai",
          150
        ),

        responsible: {
          name: responsibleName,
          cpf: responsibleCpf,
          phone: responsiblePhone
        },

        relationship,
        relationshipOther,

        school: optionalText(
          childProfile.school,
          "Escola",
          150
        ),

        grade: optionalText(
          childProfile.grade,
          "Ano escolar",
          50
        ),

        schoolShift: optionalText(
          childProfile.schoolShift,
          "Turno escolar",
          50
        ),

        receivesBolsaFamilia:
          optionalBoolean(
            childProfile.receivesBolsaFamilia,
            "Bolsa Família"
          ),

        familyResponsibleName: optionalText(
          childProfile.familyResponsibleName,
          "Nome do responsável familiar",
          150
        ),

        familyNis: normalizeNisValue(
          childProfile.familyNis,
          "NIS do responsável familiar"
        )
      }
    }

    const birthDateForDatabase = new Date(
      `${birthDate}T00:00:00.000Z`
    )

    const createdUserId = await prisma.$transaction(
      async (tx) => {
        const scfvUser = await tx.scfvUser.create({
          data: {
            activity,
            name,
            cpf,
            nis,
            birthDate: birthDateForDatabase,

            identityNumber,
            birthplace,
            sex: sex as any,
            phone,

            hasDisability,
            disabilityDetails,
            hasAllergy,
            allergyDetails,
            receivesBpc,

            isLiterate,
            educationNotes,
            activityShift: activityShift as any,

            address,
            neighborhood,
            zipCode,
            referencePoint,

            isPriority,
            priorityReasons: priorityReasons as any,

            referralOriginAgency,
            referralDocumentType,
            referralDocumentNumber,
            referralDate,

            familyMembersInfo,
            observations,

            participatesOtherService,
            otherServiceDetails,

            createdById: req.session.user.id
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

          await tx.childProfile.create({
            data: {
              scfvUserId: scfvUser.id,

              motherName:
                normalizedChildProfile.motherName,
              fatherName:
                normalizedChildProfile.fatherName,

              responsibleId: responsible.id,

              relationship:
                normalizedChildProfile.relationship,
              relationshipOther:
                normalizedChildProfile.relationshipOther,

              school:
                normalizedChildProfile.school,
              grade:
                normalizedChildProfile.grade,
              schoolShift:
                normalizedChildProfile.schoolShift,

              receivesBolsaFamilia:
                normalizedChildProfile
                  .receivesBolsaFamilia,
              familyResponsibleName:
                normalizedChildProfile
                  .familyResponsibleName,
              familyNis:
                normalizedChildProfile.familyNis
            }
          })
        }

        return scfvUser.id
      }
    )

    const user = await getDetailedScfvUser(
      createdUserId
    )

    if (!user) {
      return res.status(500).json({
        message:
          "O cadastro foi criado, mas não foi possível carregá-lo."
      })
    }

    return res.status(201).json({
      message:
        "Usuário cadastrado com sucesso.",
      user: formatDetailedScfvUser(user)
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        message: error.message
      })
    }

    console.error(error)

    return res.status(500).json({
      message:
        "Erro interno do servidor."
    })
  }
}

export async function listScfvUsers(req: any, res: any) {
  try {
    const result =
      await getFilteredScfvUsers(
        req.query
      )

    return res.status(200).json({
      total: result.users.length,
      users: result.users
    })
  } catch (error) {
    if (
      error instanceof
      ScfvUserListValidationError
    ) {
      return res.status(400).json({
        message: error.message
      })
    }

    console.error(error)

    return res.status(500).json({
      message:
        "Erro interno do servidor."
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

    const user = await getDetailedScfvUser(userId)

    if (!user) {
      return res.status(404).json({
        message: "Usuário não encontrado."
      })
    }

    return res.status(200).json({
      user: formatDetailedScfvUser(user)
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message:
        "Erro interno do servidor."
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

    const existingUser = await getDetailedScfvUser(userId)

    if (!existingUser) {
      return res.status(404).json({
        message: "Usuário não encontrado."
      })
    }

    const body = req.body ?? {}
    const currentCategory = categoryFromActivity(
      existingUser.activity
    )

    if (
      hasField(body, "category") &&
      body.category !== currentCategory
    ) {
      throw new ValidationError(
        "Não é permitido alterar um cadastro entre criança e idoso."
      )
    }

    const finalName = hasField(body, "name")
      ? requireText(body.name, "Nome")
      : existingUser.name

    let finalCpf = existingUser.cpf

    if (hasField(body, "cpf")) {
      const cpfText = requireText(
        body.cpf,
        "CPF"
      )

      finalCpf = normalizeCpf(cpfText)

      if (!isValidCpf(finalCpf)) {
        throw new ValidationError("CPF inválido.")
      }

      const cpfOwner = await prisma.scfvUser.findUnique({
        where: {
          cpf: finalCpf
        },

        select: {
          id: true
        }
      })

      if (
        cpfOwner &&
        cpfOwner.id !== userId
      ) {
        return res.status(409).json({
          message:
            "Já existe um usuário cadastrado com este CPF."
        })
      }
    }

    const finalNis = hasField(body, "nis")
      ? normalizeNisValue(body.nis)
      : existingUser.nis

    let finalBirthDate = existingUser.birthDate
    let ageResult

    if (hasField(body, "birthDate")) {
      const birthDateText = requireText(
        body.birthDate,
        "Data de nascimento"
      )

      try {
        ageResult = determineScfvActivity(
          currentCategory,
          birthDateText
        )
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(error.message)
        }

        throw new ValidationError(
          "Data de nascimento inválida."
        )
      }

      finalBirthDate = new Date(
        `${birthDateText}T00:00:00.000Z`
      )
    } else {
      ageResult = determineScfvActivity(
        currentCategory,
        existingUser.birthDate
      )
    }

    if (
      !ageResult.valid ||
      !ageResult.activity
    ) {
      throw new ValidationError(
        ageResult.message ??
        "Data de nascimento inválida."
      )
    }

    const finalActivity = ageResult.activity

    const finalIdentityNumber = hasField(
      body,
      "identityNumber"
    )
      ? optionalText(
          body.identityNumber,
          "Carteira de identidade",
          30
        )
      : existingUser.identityNumber

    const finalBirthplace = hasField(
      body,
      "birthplace"
    )
      ? optionalText(
          body.birthplace,
          "Naturalidade",
          120
        )
      : existingUser.birthplace

    const finalSex = hasField(body, "sex")
      ? normalizeSex(body.sex)
      : existingUser.sex

    const finalPhone =
      currentCategory === "ELDERLY"
        ? hasField(body, "phone")
          ? normalizePhoneValue(
              body.phone,
              "Telefone para contato"
            )
          : existingUser.phone
        : null

    const finalHasDisability = hasField(
      body,
      "hasDisability"
    )
      ? optionalBoolean(
          body.hasDisability,
          "Deficiência ou dificuldade de aprendizagem"
        )
      : existingUser.hasDisability

    let finalDisabilityDetails = hasField(
      body,
      "disabilityDetails"
    )
      ? optionalText(
          body.disabilityDetails,
          "Descrição da deficiência ou dificuldade",
          200
        )
      : existingUser.disabilityDetails

    finalDisabilityDetails = normalizeConditionalDetails(
      finalHasDisability,
      finalDisabilityDetails,
      "Informe qual é a deficiência ou dificuldade de aprendizagem."
    )

    const finalHasAllergy = hasField(
      body,
      "hasAllergy"
    )
      ? optionalBoolean(
          body.hasAllergy,
          "Alergia"
        )
      : existingUser.hasAllergy

    let finalAllergyDetails = hasField(
      body,
      "allergyDetails"
    )
      ? optionalText(
          body.allergyDetails,
          "Descrição da alergia",
          200
        )
      : existingUser.allergyDetails

    finalAllergyDetails = normalizeConditionalDetails(
      finalHasAllergy,
      finalAllergyDetails,
      "Informe qual é a alergia do usuário."
    )

    const finalReceivesBpc = hasField(
      body,
      "receivesBpc"
    )
      ? optionalBoolean(
          body.receivesBpc,
          "Benefício do BPC"
        )
      : existingUser.receivesBpc

    const finalIsLiterate = hasField(
      body,
      "isLiterate"
    )
      ? optionalBoolean(
          body.isLiterate,
          "Grau de instrução"
        )
      : existingUser.isLiterate

    const finalEducationNotes = hasField(
      body,
      "educationNotes"
    )
      ? optionalText(
          body.educationNotes,
          "Observação do grau de instrução",
          200
        )
      : existingUser.educationNotes

    const finalActivityShift = hasField(
      body,
      "activityShift"
    )
      ? normalizeActivityShift(body.activityShift)
      : existingUser.activityShift

    const finalAddress = hasField(body, "address")
      ? optionalText(
          body.address,
          "Endereço",
          200
        )
      : existingUser.address

    const finalNeighborhood = hasField(
      body,
      "neighborhood"
    )
      ? optionalText(
          body.neighborhood,
          "Bairro",
          100
        )
      : existingUser.neighborhood

    const finalZipCode = hasField(body, "zipCode")
      ? normalizeZipCode(body.zipCode)
      : existingUser.zipCode

    const finalReferencePoint = hasField(
      body,
      "referencePoint"
    )
      ? optionalText(
          body.referencePoint,
          "Ponto de referência",
          200
        )
      : existingUser.referencePoint

    const finalIsPriority = hasField(
      body,
      "isPriority"
    )
      ? optionalBoolean(
          body.isPriority,
          "Situação prioritária"
        )
      : existingUser.isPriority

    let finalPriorityReasons = hasField(
      body,
      "priorityReasons"
    )
      ? normalizePriorityReasons(
          body.priorityReasons
        )
      : [...existingUser.priorityReasons]

    if (finalIsPriority === true) {
      if (finalPriorityReasons.length === 0) {
        throw new ValidationError(
          "Selecione ao menos uma situação prioritária."
        )
      }
    } else {
      finalPriorityReasons = []
    }

    const finalReferralOriginAgency = hasField(
      body,
      "referralOriginAgency"
    )
      ? optionalText(
          body.referralOriginAgency,
          "Órgão de origem",
          150
        )
      : existingUser.referralOriginAgency

    const finalReferralDocumentType = hasField(
      body,
      "referralDocumentType"
    )
      ? optionalText(
          body.referralDocumentType,
          "Tipo de documento do encaminhamento",
          30
        )
      : existingUser.referralDocumentType

    const finalReferralDocumentNumber = hasField(
      body,
      "referralDocumentNumber"
    )
      ? optionalText(
          body.referralDocumentNumber,
          "Número do documento do encaminhamento",
          30
        )
      : existingUser.referralDocumentNumber

    const finalReferralDate = hasField(
      body,
      "referralDate"
    )
      ? normalizeOptionalDate(
          body.referralDate,
          "Data do encaminhamento"
        )
      : existingUser.referralDate

    const finalFamilyMembersInfo = hasField(
      body,
      "familyMembersInfo"
    )
      ? optionalText(
          body.familyMembersInfo,
          "Informações sobre membros da família"
        )
      : existingUser.familyMembersInfo

    const finalObservations = hasField(
      body,
      "observations"
    )
      ? optionalText(
          body.observations,
          "Observações"
        )
      : existingUser.observations

    const finalParticipatesOtherService = hasField(
      body,
      "participatesOtherService"
    )
      ? optionalBoolean(
          body.participatesOtherService,
          "Participação em outro serviço"
        )
      : existingUser.participatesOtherService

    let finalOtherServiceDetails = hasField(
      body,
      "otherServiceDetails"
    )
      ? optionalText(
          body.otherServiceDetails,
          "Outro serviço",
          200
        )
      : existingUser.otherServiceDetails

    finalOtherServiceDetails = normalizeConditionalDetails(
      finalParticipatesOtherService,
      finalOtherServiceDetails,
      "Informe de qual outro serviço o usuário participa."
    )

    let normalizedChildProfile: any = null

    if (currentCategory === "CHILDREN") {
      const input = hasField(body, "childProfile")
        ? body.childProfile
        : {}

      if (
        input === null ||
        typeof input !== "object" ||
        Array.isArray(input)
      ) {
        throw new ValidationError(
          "Os dados da ficha da criança são inválidos."
        )
      }

      const currentProfile = existingUser.childProfile

      if (!currentProfile) {
        throw new ValidationError(
          "O cadastro infantil não possui perfil de criança."
        )
      }

      let responsibleInput: any = {}

      if (hasField(input, "responsible")) {
        if (
          !input.responsible ||
          typeof input.responsible !== "object" ||
          Array.isArray(input.responsible)
        ) {
          throw new ValidationError(
            "Os dados do responsável são inválidos."
          )
        }

        responsibleInput = input.responsible
      }

      const responsibleName = hasField(
        responsibleInput,
        "name"
      )
        ? requireText(
            responsibleInput.name,
            "Nome do responsável"
          )
        : currentProfile.responsible.name

      let responsibleCpf =
        currentProfile.responsible.cpf

      if (hasField(responsibleInput, "cpf")) {
        const responsibleCpfText = requireText(
          responsibleInput.cpf,
          "CPF do responsável"
        )

        responsibleCpf = normalizeCpf(
          responsibleCpfText
        )

        if (!isValidCpf(responsibleCpf)) {
          throw new ValidationError(
            "CPF do responsável inválido."
          )
        }
      }

      if (responsibleCpf === finalCpf) {
        throw new ValidationError(
          "O CPF do responsável deve ser diferente do CPF da criança."
        )
      }

      const responsiblePhone = hasField(
        responsibleInput,
        "phone"
      )
        ? normalizePhoneValue(
            responsibleInput.phone,
            "Telefone do responsável",
            true
          )
        : currentProfile.responsible.phone

      if (!responsiblePhone) {
        throw new ValidationError(
          "Telefone do responsável é obrigatório."
        )
      }

      const relationship = hasField(
        input,
        "relationship"
      )
        ? input.relationship
        : currentProfile.relationship

      if (
        typeof relationship !== "string" ||
        !RESPONSIBLE_RELATIONSHIPS.includes(
          relationship
        )
      ) {
        throw new ValidationError(
          "Parentesco com o responsável inválido."
        )
      }

      let relationshipOther = hasField(
        input,
        "relationshipOther"
      )
        ? optionalText(
            input.relationshipOther,
            "Especificação do parentesco",
            50
          )
        : currentProfile.relationshipOther

      if (relationship === "OUTRO") {
        if (!relationshipOther) {
          throw new ValidationError(
            "Especifique o parentesco do responsável."
          )
        }
      } else {
        relationshipOther = null
      }

      normalizedChildProfile = {
        motherName: hasField(input, "motherName")
          ? optionalText(
              input.motherName,
              "Nome da mãe",
              150
            )
          : currentProfile.motherName,

        fatherName: hasField(input, "fatherName")
          ? optionalText(
              input.fatherName,
              "Nome do pai",
              150
            )
          : currentProfile.fatherName,

        responsible: {
          name: responsibleName,
          cpf: responsibleCpf,
          phone: responsiblePhone
        },

        relationship,
        relationshipOther,

        school: hasField(input, "school")
          ? optionalText(
              input.school,
              "Escola",
              150
            )
          : currentProfile.school,

        grade: hasField(input, "grade")
          ? optionalText(
              input.grade,
              "Ano escolar",
              50
            )
          : currentProfile.grade,

        schoolShift: hasField(input, "schoolShift")
          ? optionalText(
              input.schoolShift,
              "Turno escolar",
              50
            )
          : currentProfile.schoolShift,

        receivesBolsaFamilia: hasField(
          input,
          "receivesBolsaFamilia"
        )
          ? optionalBoolean(
              input.receivesBolsaFamilia,
              "Bolsa Família"
            )
          : currentProfile.receivesBolsaFamilia,

        familyResponsibleName: hasField(
          input,
          "familyResponsibleName"
        )
          ? optionalText(
              input.familyResponsibleName,
              "Nome do responsável familiar",
              150
            )
          : currentProfile.familyResponsibleName,

        familyNis: hasField(input, "familyNis")
          ? normalizeNisValue(
              input.familyNis,
              "NIS do responsável familiar"
            )
          : currentProfile.familyNis
      }
    } else if (hasField(body, "childProfile")) {
      throw new ValidationError(
        "Dados de criança não se aplicam ao cadastro de idoso."
      )
    }

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
            birthDate: finalBirthDate,
            activity: finalActivity,

            identityNumber:
              finalIdentityNumber,
            birthplace:
              finalBirthplace,
            sex: finalSex as any,
            phone: finalPhone,

            hasDisability:
              finalHasDisability,
            disabilityDetails:
              finalDisabilityDetails,
            hasAllergy:
              finalHasAllergy,
            allergyDetails:
              finalAllergyDetails,
            receivesBpc:
              finalReceivesBpc,

            isLiterate:
              finalIsLiterate,
            educationNotes:
              finalEducationNotes,
            activityShift:
              finalActivityShift as any,

            address:
              finalAddress,
            neighborhood:
              finalNeighborhood,
            zipCode:
              finalZipCode,
            referencePoint:
              finalReferencePoint,

            isPriority:
              finalIsPriority,
            priorityReasons: {
              set: finalPriorityReasons as any
            },

            referralOriginAgency:
              finalReferralOriginAgency,
            referralDocumentType:
              finalReferralDocumentType,
            referralDocumentNumber:
              finalReferralDocumentNumber,
            referralDate:
              finalReferralDate,

            familyMembersInfo:
              finalFamilyMembersInfo,
            observations:
              finalObservations,

            participatesOtherService:
              finalParticipatesOtherService,
            otherServiceDetails:
              finalOtherServiceDetails,

            updatedById:
              req.session.user.id
          }
        })

        if (
          currentCategory === "CHILDREN" &&
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
              motherName:
                normalizedChildProfile.motherName,
              fatherName:
                normalizedChildProfile.fatherName,

              responsibleId: responsible.id,

              relationship:
                normalizedChildProfile.relationship,
              relationshipOther:
                normalizedChildProfile.relationshipOther,

              school:
                normalizedChildProfile.school,
              grade:
                normalizedChildProfile.grade,
              schoolShift:
                normalizedChildProfile.schoolShift,

              receivesBolsaFamilia:
                normalizedChildProfile
                  .receivesBolsaFamilia,
              familyResponsibleName:
                normalizedChildProfile
                  .familyResponsibleName,
              familyNis:
                normalizedChildProfile.familyNis
            },

            create: {
              scfvUserId: userId,

              motherName:
                normalizedChildProfile.motherName,
              fatherName:
                normalizedChildProfile.fatherName,

              responsibleId: responsible.id,

              relationship:
                normalizedChildProfile.relationship,
              relationshipOther:
                normalizedChildProfile.relationshipOther,

              school:
                normalizedChildProfile.school,
              grade:
                normalizedChildProfile.grade,
              schoolShift:
                normalizedChildProfile.schoolShift,

              receivesBolsaFamilia:
                normalizedChildProfile
                  .receivesBolsaFamilia,
              familyResponsibleName:
                normalizedChildProfile
                  .familyResponsibleName,
              familyNis:
                normalizedChildProfile.familyNis
            }
          })
        }
      }
    )

    const updatedUser = await getDetailedScfvUser(userId)

    if (!updatedUser) {
      return res.status(404).json({
        message: "Usuário não encontrado."
      })
    }

    return res.status(200).json({
      message:
        "Cadastro atualizado com sucesso.",
      user: formatDetailedScfvUser(updatedUser)
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        message: error.message
      })
    }

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
        message:
          "Usuário inativado com sucesso.",

        user: {
          id: user.id,
          name: user.name,
          active: user.active,
          deactivationType:
            user.deactivationType,
          inactiveReason:
            user.inactiveReason,
          inactiveAt:
            user.inactiveAt
        }
      })
    }

    const age = calculateAge(
      existingUser.birthDate
    )

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
      message:
        "Usuário reativado com sucesso.",

      user: {
        id: user.id,
        name: user.name,
        active: user.active
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

export async function uploadScfvUserPhoto(
  req: any,
  res: any
) {
  try {
    const userId = Number(req.params.id)

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      if (req.file?.path) {
        await fs.unlink(req.file.path)
          .catch(() => {})
      }

      return res.status(400).json({
        message:
          "ID de usuário inválido."
      })
    }

    if (!req.file) {
      return res.status(400).json({
        message:
          "Nenhuma foto foi enviada."
      })
    }

    const existingUser =
      await prisma.scfvUser.findUnique({
        where: {
          id: userId
        },

        select: {
          id: true,
          photoPath: true
        }
      })

    if (!existingUser) {
      await fs.unlink(req.file.path)
        .catch(() => {})

      return res.status(404).json({
        message:
          "Usuário não encontrado."
      })
    }

    const relativePhotoPath =
      path
        .relative(
          process.cwd(),
          req.file.path
        )
        .replaceAll("\\", "/")

    const user =
      await prisma.scfvUser.update({
        where: {
          id: userId
        },

        data: {
          photoPath:
            relativePhotoPath,

          updatedById:
            req.session.user.id
        }
      })

    if (existingUser.photoPath) {
      const oldPhotoPath =
        path.resolve(
          process.cwd(),
          existingUser.photoPath
        )

      await fs.unlink(oldPhotoPath)
        .catch(() => {})
    }

    return res.status(200).json({
      message:
        "Foto atualizada com sucesso.",

      photo: {
        path: user.photoPath,
        url:
          `/api/scfv-users/${user.id}/photo`
      }
    })
  } catch (error) {
    console.error(error)

    if (req.file?.path) {
      await fs.unlink(req.file.path)
        .catch(() => {})
    }

    return res.status(500).json({
      message:
        "Erro interno do servidor."
    })
  }
}

export async function getScfvUserPhoto(
  req: any,
  res: any
) {
  try {
    const userId = Number(req.params.id)

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        message:
          "ID de usuário inválido."
      })
    }

    const user =
      await prisma.scfvUser.findUnique({
        where: {
          id: userId
        },

        select: {
          photoPath: true
        }
      })

    if (!user) {
      return res.status(404).json({
        message:
          "Usuário não encontrado."
      })
    }

    if (!user.photoPath) {
      return res.status(404).json({
        message:
          "Este usuário não possui foto."
      })
    }

    const absolutePhotoPath =
      path.resolve(
        process.cwd(),
        user.photoPath
      )

    try {
      await fs.access(
        absolutePhotoPath
      )
    } catch {
      return res.status(404).json({
        message:
          "Arquivo da foto não encontrado."
      })
    }

    return res.sendFile(
      absolutePhotoPath
    )
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message:
        "Erro interno do servidor."
    })
  }
}

export async function removeScfvUserPhoto(
  req: any,
  res: any
) {
  try {
    const userId = Number(req.params.id)

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        message:
          "ID de usuário inválido."
      })
    }

    const existingUser =
      await prisma.scfvUser.findUnique({
        where: {
          id: userId
        },

        select: {
          id: true,
          photoPath: true
        }
      })

    if (!existingUser) {
      return res.status(404).json({
        message:
          "Usuário não encontrado."
      })
    }

    if (!existingUser.photoPath) {
      return res.status(400).json({
        message:
          "Este usuário não possui foto."
      })
    }

    await prisma.scfvUser.update({
      where: {
        id: userId
      },

      data: {
        photoPath: null,

        updatedById:
          req.session.user.id
      }
    })

    const absolutePhotoPath =
      path.resolve(
        process.cwd(),
        existingUser.photoPath
      )

    await fs.unlink(
      absolutePhotoPath
    ).catch(() => {})

    return res.status(200).json({
      message:
        "Foto removida com sucesso."
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message:
        "Erro interno do servidor."
    })
  }
}
