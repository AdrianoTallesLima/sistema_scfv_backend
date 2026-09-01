import { Router } from "express"
import {
  createUser,
  listUsers,
  changeUserStatus,
  updateUser,
  resetUserPassword
} from "../controllers/userController.js"
import { authenticate, adminOnly } from "../middlewares/authMiddleware.js"

const router = Router()

router.get("/", authenticate, adminOnly, listUsers)

router.post("/", authenticate, adminOnly, createUser)

router.patch(
  "/:id/password",
  authenticate,
  adminOnly,
  resetUserPassword
)

router.patch(
  "/:id/status",
  authenticate,
  adminOnly,
  changeUserStatus
)

router.patch(
  "/:id",
  authenticate,
  adminOnly,
  updateUser
)
export default router
