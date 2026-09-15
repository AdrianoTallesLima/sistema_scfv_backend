import { Router } from "express"
import {
  createScfvUser,
  listScfvUsers
} from "../controllers/scfvUserController.js"
import { authenticate } from "../middlewares/authMiddleware.js"

const router = Router()

router.get("/", authenticate, listScfvUsers)
router.post("/", authenticate, createScfvUser)

export default router