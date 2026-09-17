import { prisma } from "../db.js"
import { calculateAge } from "../utils/age.js"

const AGE_LIMIT_REASON =
  "Limite de idade atingido pelo usuario!"

export async function applyScfvAgeRules() {
  const activeChildren =
    await prisma.scfvUser.findMany({
      where: {
        active: true,

        activity: {
          in: [
            "SCFV_0_6",
            "SCFV_7_15"
          ]
        }
      },

      select: {
        id: true,
        name: true,
        birthDate: true,
        activity: true
      }
    })

  // Calculamos a idade apenas uma vez
  // para cada usuário.
  const childrenWithAge =
    activeChildren.map((user) => ({
      ...user,
      age: calculateAge(user.birthDate)
    }))

  // Crianças que já completaram 7 anos,
  // mas ainda continuam na faixa 0–6.
  const usersToReclassify =
    childrenWithAge.filter(
      (user) =>
        user.activity === "SCFV_0_6" &&
        user.age >= 7 &&
        user.age <= 15
    )

  // Crianças que atingiram o limite
  // máximo do SCFV.
  const usersToDeactivate =
    childrenWithAge.filter(
      (user) => user.age >= 16
    )

  const result = await prisma.$transaction(
    async (tx) => {
      let reclassifiedCount = 0
      let deactivatedCount = 0

      if (usersToReclassify.length > 0) {
        const ids =
          usersToReclassify.map(
            (user) => user.id
          )

        const reclassified =
          await tx.scfvUser.updateMany({
            where: {
              id: {
                in: ids
              },

              active: true,
              activity: "SCFV_0_6"
            },

            data: {
              activity: "SCFV_7_15",

              // Alteração automática do sistema.
              updatedById: null
            }
          })

        reclassifiedCount =
          reclassified.count
      }

      if (usersToDeactivate.length > 0) {
        const ids =
          usersToDeactivate.map(
            (user) => user.id
          )

        const deactivated =
          await tx.scfvUser.updateMany({
            where: {
              id: {
                in: ids
              },

              active: true
            },

            data: {
              active: false,

              deactivationType:
                "AGE_LIMIT",

              inactiveReason:
                AGE_LIMIT_REASON,

              inactiveAt: new Date(),

              // Alteração automática do sistema.
              updatedById: null
            }
          })

        deactivatedCount =
          deactivated.count
      }

      return {
        reclassifiedCount,
        deactivatedCount
      }
    }
  )

  return {
    reclassified: {
      count:
        result.reclassifiedCount,

      users:
        usersToReclassify.map(
          (user) => ({
            id: user.id,
            name: user.name,
            age: user.age
          })
        )
    },

    deactivated: {
      count:
        result.deactivatedCount,

      users:
        usersToDeactivate.map(
          (user) => ({
            id: user.id,
            name: user.name,
            age: user.age
          })
        )
    }
  }
}