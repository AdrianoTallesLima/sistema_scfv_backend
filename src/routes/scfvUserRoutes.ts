import { Router } from "express"
import {
  createScfvUser,
  listScfvUsers,
  getScfvUserById,
  updateScfvUser
} from "../controllers/scfvUserController.js"
import { authenticate } from "../middlewares/authMiddleware.js"

const router = Router()

router.get("/", authenticate, listScfvUsers)
router.get("/:id", authenticate, getScfvUserById)
router.post("/", authenticate, createScfvUser)
router.patch("/:id", authenticate, updateScfvUser)

export default router
