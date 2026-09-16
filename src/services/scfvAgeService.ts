import { prisma } from "../db.js"
import { shouldDeactivateChildByAge } from "../utils/age.js"

const AGE_LIMIT_REASON =
  "Limite de idade atingido pelo usuario!"

export async function deactivateUsersByAgeLimit() {
  const activeChildren = await prisma.scfvUser.findMany({
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
      birthDate: true
    }
  })

  const usersToDeactivate = activeChildren.filter(
    (user) =>
      shouldDeactivateChildByAge(user.birthDate)
  )

  if (usersToDeactivate.length === 0) {
    return {
      count: 0,
      users: []
    }
  }

  const ids = usersToDeactivate.map(
    (user) => user.id
  )

  const inactiveAt = new Date()

  const result = await prisma.scfvUser.updateMany({
    where: {
      id: {
        in: ids
      },

      active: true
    },

    data: {
      active: false,
      deactivationType: "AGE_LIMIT",

      inactiveReason:
        AGE_LIMIT_REASON,

      inactiveAt,

      // A alteração foi feita pelo sistema,
      // não por um orientador.
      updatedById: null
    }
  })

  return {
    count: result.count,

    users: usersToDeactivate.map((user) => ({
      id: user.id,
      name: user.name
    }))
  }
}