import { Router } from "express"
import {
  createUser,
  listUsers,
  changeUserStatus,
  updateUser
} from "../controllers/userController.js"
import { authenticate, adminOnly } from "../middlewares/authMiddleware.js"

const router = Router()

router.get("/", authenticate, adminOnly, listUsers)
router.post("/", authenticate, adminOnly, createUser)
router.patch(
  "/:id",
  authenticate,
  adminOnly,
  updateUser
)

export default router
