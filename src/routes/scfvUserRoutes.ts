import { Router } from "express"
import {
  createScfvUser,
  listScfvUsers,
  getScfvUserById,
  updateScfvUser,
  changeScfvUserStatus,
  uploadScfvUserPhoto,
  getScfvUserPhoto,
  removeScfvUserPhoto
} from "../controllers/scfvUserController.js"
import { handleScfvPhotoUpload } from "../middlewares/uploadMiddleware.js"
import { authenticate } from "../middlewares/authMiddleware.js"

const router = Router()

router.get(
  "/:id/photo",
  authenticate,
  getScfvUserPhoto
)

router.post(
  "/:id/photo",
  authenticate,
  handleScfvPhotoUpload,
  uploadScfvUserPhoto
)

router.delete(
  "/:id/photo",
  authenticate,
  removeScfvUserPhoto
)

router.get("/", authenticate, listScfvUsers)
router.get("/:id", authenticate, getScfvUserById)

router.post("/", authenticate, createScfvUser)

router.patch("/:id/status", authenticate, changeScfvUserStatus)
router.patch("/:id", authenticate, updateScfvUser)

export default router
